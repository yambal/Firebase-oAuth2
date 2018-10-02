# Firebase-oAuth2
Firebase oAuth2

    const oAuth2 = require('yambal_firebase_oauth2');
    const buildin_client = {
	    client_id : 'buildin_client',
	    client_secret : 'abcdef',
	    expires_in : 60 * 15
    }
    const oAuth2App = oAuth2(admin, buildin_client)
    exports.AcountLink = functions.https.onRequest(oAuth2App);
