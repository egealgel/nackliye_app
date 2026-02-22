// App config - supports EXPO_PUBLIC_EAS_PROJECT_ID for push notifications
const appJson = require('./app.json');
export default {
  expo: {
    ...appJson.expo,
    extra: {
      eas: {
        projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID ?? '29cdaf98-349b-426f-8a8a-3bf504769664',
      },
    },
  },
};
