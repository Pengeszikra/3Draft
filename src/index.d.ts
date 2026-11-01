export const name: '3draft';
export const version: string;

export interface Info {
  name: string;
  version: string;
  stage: 'pre-alpha';
  goals: string[];
}

export function info(): Info;
