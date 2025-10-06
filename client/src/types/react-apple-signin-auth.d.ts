declare module 'react-apple-signin-auth' {
  import { ComponentType } from 'react';

  export interface AppleSigninProps {
    authOptions: {
      clientId: string;
      scope: string;
      redirectURI: string;
      state: string;
      nonce: string;
      usePopup: boolean;
    };
    onSuccess: (response: any) => void;
    onError: (error: any) => void;
    uiType?: string;
    render?: (props: any) => React.ReactElement;
  }

  const AppleSignin: ComponentType<AppleSigninProps>;
  export default AppleSignin;
}

