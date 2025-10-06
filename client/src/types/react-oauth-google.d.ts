declare module '@react-oauth/google' {
  import { ReactNode } from 'react';

  export interface GoogleOAuthProviderProps {
    children: ReactNode;
    clientId: string;
  }

  export interface GoogleLoginProps {
    onSuccess?: (credentialResponse: any) => void;
    onError?: () => void;
    useOneTap?: boolean;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    theme?: string;
    size?: string;
    width?: string;
    text?: string;
    shape?: string;
    logo_alignment?: string;
  }

  export class GoogleOAuthProvider extends React.Component<GoogleOAuthProviderProps> {}
  export class GoogleLogin extends React.Component<GoogleLoginProps> {}
}
