import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.asscatccis.icns',
    appName: 'ICNS Navigator',
    // Point to your live Hostinger deployment
    // The app will load the website directly — no local build needed
    server: {
        url: 'https://icns.asscatccis.com',
        cleartext: false,
        androidScheme: 'https',
    },
    android: {
        allowMixedContent: false,
        captureInput: true,
        webContentsDebuggingEnabled: false,
    },
    plugins: {
        // Allow camera access for AR features
        Camera: {
            permissions: ['camera'],
        },
    },
};

export default config;
