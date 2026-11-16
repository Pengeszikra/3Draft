# VR on the Meta Quest 3: the black headset, and how it was found

**Short version:** 3Draft's WebXR view showed nothing on a real Quest 3 for days, though it worked in the desktop emulator. The
cause was one option: the `XRWebGLLayer` was created with `alpha: false`. On the Quest 3 (Oculus Browser 156, Adreno 740) that
gives an XR framebuffer that is **incomplete** (`FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT`, `0x8cd7`), so every `clear` and
every draw call fails with `GL_INVALID_FRAMEBUFFER_OPERATION` (`0x506`) and nothing reaches the eyes. With `alpha: true`, as
three.js does it, the framebuffer is complete and 3Draft draws in the headset.

```js
// app/index.html, toggleXr
const baseLayer = new XRWebGLLayer(session, gl, { antialias: true, depth: true, stencil: false, alpha: true });
```

## Symptoms

- The VR button on the Quest: the session starts, the headset goes into immersive mode, and the view is black.
- In the desktop browser with the Meta Immersive Web Emulator (IWER) the same code drew the scene correctly.
- No exception anywhere: the session, `makeXRCompatible`, the layer (3360×1760) and both eyes' viewports (1680×1760 each)
  were all fine. The page itself (outside VR) rendered normally with the same WebGL2 renderer.
- A three.js test scene in the same browser, on the same headset, worked.

## What did *not* help (and why it was still worth doing)

Each of these was a real bug or a real risk, and fixing them removed noise, but none of them was the black screen:

| Change | What it fixed |
|---|---|
| Request the XR session first, switch the view to WebGL2 after | the user activation expiring while the WebGL2 view was built |
| Serve the engine from the Spider site (`engine/<commit>/`) | jsDelivr returning 404 for fresh commits (a blank page) |
| Draw the star glows and galaxy clouds into the XR layer (`xrSkyDraw`) | the sky's 2D overlay canvases do not exist in a headset |
| Scale head and eye translation to light years (`xrRig().scale`) | metres used as scene units in a star map |
| Convert the OpenGL XR projection to the engine's 0..w depth | `P[i] = (P[i] + P[i+1]) / 2` for i = 2, 6, 10, 14 |
| Ignore button 6 (the thumb rest), drop the press flash | a green sky: the thumb rest reads "pressed" all the time |
| Sanitise null / NaN controller axes (GPT) | IWER crashing `toFixed` |
| Equal-width eye fallback for invalid viewports (GPT) | IWER's zero-width right eye |

## How it was found

1. **A side-by-side page** (`app/xr-compare.html`): the same tiny scene (a cube, an egg, a floor grid, 500 stars) drawn once with
   three.js and once with 3Draft's own renderer, each with its own WebXR session. Left X leaves either session. This proved the
   headset, the browser and WebXR were fine, and that the fault was in 3Draft's path.
2. **A remote log**, because a Quest browser cannot be screenshotted and its console is hard to reach: every log line is
   batched once a second and POSTed to `https://ntfy.sh/spider-xr-<4 letters>`. The page shows the 4-letter code; the log is
   read back on a desktop with `fetch('https://ntfy.sh/spider-xr-<code>/json?poll=1&since=all')`.
3. **The first log** said: every frame, `GL error 0x506`. 154 frames, 154 errors. So the draw calls were refused, not wrong.
4. **A GL call tracer**: for the first three VR frames every method of the WebGL2 context is wrapped and followed by
   `getError()`; the first failing call is logged with its name and arguments, together with
   `checkFramebufferStatus` of the XR framebuffer at the start of the frame. A second button started the same 3Draft scene
   with the layer options three.js uses.
5. **The second log** settled it:
   - `alpha: false` → `framebuffer status 0x8cd7`, then `GL error 0x506 from clear(0x4100)` and
     `from drawArrays(4, 0, …)`, on every frame;
   - `alpha: true` → `framebuffer status complete`, 132 frames, **0 errors**, and the cube and the egg were in the headset.

## Lessons

- **Copy the known-good path's options first.** three.js's `WebXRManager` was the working reference all along; its layer
  options differ from ours in one value, and that value was the bug. Diff the setup (context attributes, layer init, render
  state) before suspecting the renderer.
- **`alpha: false` on an `XRWebGLLayer` is not safe on Quest.** The spec allows it, the emulator accepts it, the headset
  hands back an incomplete opaque framebuffer without throwing.
- **Check `checkFramebufferStatus` on the XR framebuffer inside the frame.** Outside a frame it is expected to be
  incomplete (`0x8cdd`); inside the frame it must be `FRAMEBUFFER_COMPLETE`. That one line would have found this in minutes.
- **Log the failing call, not just the error.** `getError()` once per frame says "something failed"; wrapping the context
  for a few frames says exactly which call and on which framebuffer.
- **An emulator is not the device.** IWER runs on the desktop GPU and its own framebuffer; it cannot show driver or
  browser-specific framebuffer behaviour.
- **Build a remote log early** for any device without a usable console. A public push channel (ntfy.sh) needs no server.

## Where things are

- `app/index.html`: `toggleXr` (session, layer), `xrFrameBody` (per-eye rendering), `xrSkyDraw`, `xrHudDraw` (the flight
  readout panel in the headset), `xrFly` (the Quest controller mapping), `xrLog` (console, `__3draft.xr().log`, localStorage
  `3draft-xr-log`).
- `app/xr-compare.html`: the side-by-side page with the remote log and the GL call tracer (kept as a diagnostic).
- `app/xr-test.html`: the minimal standalone WebXR test.
