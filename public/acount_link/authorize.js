// https://github.com/firebase/firebaseui-web/blob/master/demo/public/app.js
var uiConfig = {
	callbacks: {
		signInSuccessWithAuthResult: function(authResult, redirectUrl) {
			document.getElementById("user-signed-in").style.display = "block";
			document.getElementById("user-signed-out").style.display = "none";
			console.log("signInSuccessWithAuthResult");
			if (authResult.user) {
				handleSignedInUser(authResult.user);
			}
			if (authResult.additionalUserInfo) {
			  document.getElementById('is-new-user').textContent = authResult.additionalUserInfo.isNewUser ? 'New User' : 'Existing User'
			}
			return false;
		}
	},
	signInFlow: "redirect",
	signInOptions: [
		firebase.auth.GoogleAuthProvider.PROVIDER_ID
	],
	tosUrl: "<your-tos-url>",
	privacyPolicyUrl: function() {
		window.location.assign("<your-privacy-policy-url>");
	}
};
var ui = new firebaseui.auth.AuthUI(firebase.auth());
ui.disableAutoSignIn();

var handleSignedInUser = function(user) {
	document.getElementById("user-signed-in").style.display = "block";
	document.getElementById("user-signed-out").style.display = "none";
	document.getElementById("name").textContent = user.displayName;
	document.getElementById("email").textContent = user.email;
	document.getElementById("phone").textContent = user.phoneNumber;
	if (user.photoURL) {
		var photoURL = user.photoURL;
		if (
			photoURL.indexOf("googleusercontent.com") != -1 ||
			photoURL.indexOf("ggpht.com") != -1
		) {
			photoURL = photoURL + "?sz=" + document.getElementById("photo").clientHeight;
		}
		document.getElementById("photo").src = photoURL;
		document.getElementById("photo").style.display = "block";
	} else {
		document.getElementById("photo").style.display = "none";
	}
	firebase
		.auth()
		.currentUser.getIdToken(true)
		.then(function(idToken) {
			console.log(idToken)
			document.getElementById("id-token").value = idToken
			document.getElementById("acount-link").style.display = "block";
		},function(error){
			console.log(error)
		})
		.catch(function(error){
			console.log(error)
		})
};

var handleSignedOutUser = function() {
	document.getElementById("user-signed-in").style.display = "none";
	document.getElementById("user-signed-out").style.display = "block";
	ui.start("#firebaseui-container", uiConfig);
};

firebase.auth().onAuthStateChanged(function(user) {
	document.getElementById("loading").style.display = "none";
	document.getElementById("loaded").style.display = "block";
	user ? handleSignedInUser(user) : handleSignedOutUser();
});

var initApp = function() {
	
	document.getElementById("sign-out").addEventListener("click", function() {
		firebase.auth().signOut();
	});
	/*
	document.getElementById('delete-account').addEventListener('click', function() {
	  firebase.auth().currentUser.delete().catch(function(error) {
	    if (error.code == 'auth/requires-recent-login') {
	      firebase.auth().signOut().then(function() {
	        setTimeout(function() {
	          alert('Please sign in again to delete your account.');
	        }, 1);
	      });
	    }
	  });
    });
    */
};
window.addEventListener("load", initApp);