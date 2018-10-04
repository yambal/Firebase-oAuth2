const express = require("express");
const AcountLinkApp = express();
const nanoid = require("nanoid");

const APP_URI = "acount-link";
const APP_VIEW_DIR = "./views/acount_link";
const APP_PUBLIC_DIR = "./public/acount_link";
/**
index.js
exports.[AcountLink] = functions.https.onRequest(acountLink);
...

firebase.json
...
"rewrites": [
  {
    "source": "/[APP_URI]/**",
    "function": "[AcountLink]"
  }
  ...
]
**/

AcountLinkApp.set("view engine", "pug");
AcountLinkApp.set("views", APP_VIEW_DIR);

let buildin_client
let admin;
let dbRef;

AcountLinkApp.use("/" + APP_URI + "/static", express.static(APP_PUBLIC_DIR));

AcountLinkApp.use(function(req, res, next) {
	const fullUrl = req.protocol + "://" + req.get("host") + req.originalUrl;
	console.log("-- %s %s", req.method, fullUrl);
	next();
});

// https://my-iot-1cb20.firebaseapp.com/...
AcountLinkApp.get("/" + APP_URI + "/test", (req, res) => {
	console.log("/" + APP_URI + "/authorize");
	console.log("/" + APP_URI + "/authorize");
	res.json({ message: "ok" });
});

// 認証画面を描画する
AcountLinkApp.get("/" + APP_URI + "/authorize", (req, res) => {
	return res.render("authorize", {
		authorized_uri: "/" + APP_URI + "/authorized",
		authorize_js_uri: "/" + APP_URI + "/static/authorize.js",
		title: "Hey",
		message: "Hello there!",
		response_type: req.query.response_type,
		client_id: req.query.client_id,
		redirect_uri: req.query.redirect_uri,
		scope: req.query.scope,
		state: req.query.state
	});
});

// 認証結果の idToken を Post
AcountLinkApp.post("/" + APP_URI + "/authorized", (req, res) => {
	const body = req.body;
	console.log(body);

	let uid;

	idTokenToUid(body.id_token)
		.then(function(_uid) {
			uid = _uid;
			return clearToken(uid, body.client_id);
		})
		.then(function(){
			return getUsersClientInfo(uid, body.client_id)
		})
		.then(function(clientInfo) {
			console.log('clientInfo : ', clientInfo)
			return addAuthorizationCode(uid, body.client_id);
		},function(){
			// 見つからなかった
		})
		.then(function(authorization_code) {
			const uri =
				body.redirect_uri +
				"?code=" +
				decodeURIComponent(authorization_code) +
				"&state=" +
				decodeURIComponent(body.state);
			//console.log(76, uri);
			res.redirect(301, uri);
		});
});

AcountLinkApp.post("/" + APP_URI + "/accesstoken**", (req, res) => {
	const grantType = req.query.grant_type
		? req.query.grant_type
		: req.body.grant_type;

	const client_secret = req.body.client_secret;
	const client_id = req.body.client_id;

	console.log('Access Token :' + grantType)

	if (grantType === "authorization_code") {
		// 認証コード > Token
		const authorize_code = req.body.code;
		authorizationCodeToToken(authorize_code, client_id, client_secret)
		.then(function(token) {
			res.status(200).json(token);
		}, function(error){
			/** TO-Do **/
			console.log(106,error)
		});
	} else if (grantType === "refresh_token") {
		// Refresh Token > Token
		const refresh_token = req.body.refresh_token;

		refreshTokenToToken(refresh_token, client_id, client_secret)
		.then(function(token) {
			res.status(200).json(token);
		}, function(error){
			/** TO-Do **/
			console.log(106,error)
		});
	}
});

// ===================================
const idTokenToUid = idToken => {
	return new Promise(function(resolve, reject) {
		admin
			.auth()
			.verifyIdToken(idToken)
			.then(
				function(decodedToken) {
					var uid = decodedToken.uid;
					resolve(uid);
				},
				function(error) {
					console.log("idTokenToUid", error);
				}
			);
	});
};

// uid と　client id から client の情報を取得する
const getUsersClientInfo = (uid, client_id) => {
	return new Promise(function(resolve, reject) {
		return dbRef.child("users/" + uid + "/clients/" + client_id).once("value")
		.then(function(snapshot){
			if (snapshot.val()) {
				resolve({
					client_secret : snapshot.val().client_secret,
					expires_in : snapshot.val().expires_in,
					token_type : snapshot.val().token_type
				})
			}else if(buildin_client && client_id == buildin_client.client_id){
				// Buildin Client
				const client_secret = buildin_client.client_secret
				const expires_in = buildin_client.expires_in
				const token_type = 'bearer'

				return dbRef.child("users/" + uid + "/clients/" + client_id).set({
					create : Math.floor(new Date().getTime() / 1000),
					client_secret : client_secret,
					expires_in : expires_in,
					token_type : token_type
				})
				.then(function(){
					resolve({
						client_secret : client_secret,
						expires_in : expires_in,
						token_type : token_type
					})
				})
			}else{
				reject()
			}
		})
	});
}

// 認証コード > Token
const authorizationCodeToToken = (authorize_code, client_id, input_client_secret) => {
	let uid
	let token

	return new Promise(function(resolve, reject) {
		// 認可コードから uid と client id を得る
		return getUidClientId_from_AuthorizationCode(authorize_code)
		.then(function(uidClientId){
			// uid と client id を取得できた
			uid = uidClientId.uid
			if(client_id == uidClientId.client_id){
				// 合致した > 削除
				return clearToken(uid, client_id);
			}else{
				// 合致しなかった
			}
		})
		.then(function(){
			// Client の情報を取得
			return getUsersClientInfo(uid, client_id)
		})
		.then(function(clientInfo){
			// Client の情報を取得 > 成功
			if(clientInfo.client_secret == input_client_secret){
				// Acsess Token を作成する
				return addAccessToken(uid, client_id, clientInfo.expires_in, clientInfo.token_type);
			}else{
				// client secret がマッチしなかった
			}
		},function(){
			// Client の情報を取得 > 該当なし
		})
		.then(function(_token) {
			// Acsess Token を作成した > Refreash Token を更新
			token = _token;
			return addRefreshToken(uid, client_id);
		})
		.then(function(_refresh_token) {
			token.refresh_token = _refresh_token;
			resolve(token);
		});
	});
};

// Refresh Token > Token
const refreshTokenToToken = (refresh_token, client_id, input_client_secret) => {
	let uid;
	let token;

	return new Promise(function(resolve, reject) {
		getUidClientId_from_RefreshToken(refresh_token)
		.then(function(res) {
			//console.log(237, res)
			uid = res.uid;
			if(res.client_id == client_id){
				// 合致した > 削除
				return clearToken(uid, client_id)
			}else{
				// 合致しなかった
			}
		},function(){
			// 合致しなかった
			//console.log(245)
		})
		.then(function(){
			// 削除 > Client の情報を取得
			//console.log(251)
			return getUsersClientInfo(uid, client_id)
		})
		.then(function(clientInfo) {
			// Client の情報を取得 > 成功
			//console.log(256, clientInfo, input_client_secret)
			if(clientInfo.client_secret == input_client_secret){
				// Acsess Token を作成する
				return addAccessToken(uid, client_id, clientInfo.expires_in, clientInfo.token_type);
			}else{
				// client secret がマッチしなかった
				console.log(262, clientInfo.client_secret, input_client_secret)
			}
		}, function(){
			//console.log(264)
		})
		.then(function(_token) {
			//console.log(267)
			token = _token;
			return addRefreshToken(uid, client_id);
		})
		.then(function(_refresh_token) {
			//console.log(272)
			token.refresh_token = _refresh_token;
			resolve(token);
		});
	});
};

const addAccessToken = (uid, client_id, expires_in, token_type) => {
	return new Promise(function(resolve, reject) {
		console.log('addAccessToken', uid, client_id, expires_in, token_type)
		if (uid) {
			const access_token = uid + "_" + nanoid();
			const due = Math.floor(new Date().getTime() / 1000) + expires_in;

			return dbRef
				.child("access_tokens/" + access_token)
				.set({
					uid: uid,
					token_type: token_type,
					expires_in: expires_in,
					client_id: client_id,
					due: due
				})
				.then(
					function() {
						return dbRef
							.child("users/" + uid + "/clients/" + client_id)
							.update({
								access_token: access_token
							})
							.then(
								function() {
									resolve({
										access_token: access_token,
										token_type: token_type,
										expires_in: expires_in
									});
								},
								function(error) {}
							);
					},
					function(error) {}
				);
		} else {
			reject();
		}
	});
};

const addRefreshToken = (uid, client_id) => {
	return new Promise(function(resolve, reject) {
		if (uid) {
			const refresh_token = uid + "_" + nanoid();

			return dbRef
				.child("refresh_tokens/" + refresh_token)
				.set({
					uid: uid,
					client_id: client_id
				})
				.then(
					function() {
						return dbRef
							.child("users/" + uid + "/clients/" + client_id)
							.update({
								refresh_token: refresh_token
							})
							.then(
								function() {
									resolve(refresh_token);
								},
								function(error) {}
							);
					},
					function(error) {}
				);
		} else {
			reject();
		}
	});
};

// 認可コードから uid と client id を得る
const getUidClientId_from_AuthorizationCode = authorize_code => {
	return new Promise(function(resolve, reject) {
		if (authorize_code) {
			dbRef
				.child("authorization_codes/" + authorize_code)
				.once("value")
				.then(
					function(snapshot) {
						let uid = null;
						let client_id = null;
						if (snapshot.val()) {
							uid = snapshot.val().uid;
							client_id = snapshot.val().client_id;
						}
						resolve({
							uid: uid,
							client_id: client_id
						});
					},
					function(error) {
						console.log("getUidClientId_from_AuthorizationCode", error);
					}
				);
		} else {
			reject();
		}
	});
};

const getUidClientId_from_RefreshToken = refresh_token => {
	return new Promise(function(resolve, reject) {
		if (refresh_token) {
			dbRef
				.child("refresh_tokens/" + refresh_token)
				.once("value")
				.then(
					function(snapshot) {
						let uid = null
						let client_id = null
						if (snapshot.val()) {
							uid = snapshot.val().uid
							client_id = snapshot.val().client_id
							resolve({
								uid: uid,
								client_id: client_id
							});
						}

					},
					function(error) {
						console.log("getUidClientId_from_RefreshToken", error);
					}
				);
		} else {
			reject();
		}
	});
};

// 認証コードを発行する
const addAuthorizationCode = (uid, client_id) => {
	return new Promise(function(resolve, reject) {
		const authorization_code = uid + "_" + nanoid();

		dbRef
			.child("users/" + uid + "/clients/" + client_id)
			.update({
				authorization_code: authorization_code
			})
			.then(function() {
				dbRef
					.child("authorization_codes/" + authorization_code)
					.update({
						uid: uid,
						client_id: client_id
					})
					.then(function() {
						resolve(authorization_code);
					});
			});
	});
};

// ユーザーの Token をクリアする
const clearToken = (uid, client_id) => {
	let tokens;
	return getToken_from_UidClientId(uid, client_id).then(function(_tokens) {
		//console.log(114, _tokens);
		tokens = _tokens;
		return deleteAuthorizationCode(tokens.authorization_code, client_id)
			.then(function() {
				//console.log(117);
				return dbRef
					.child(
						"users/" +
							uid +
							"/clients/" +
							client_id +
							"/authorization_code"
					)
					.remove();
			})
			.then(function() {
				//console.log(121);
				return deleteAccessToken(tokens.access_token);
			})
			.then(function() {
				//console.log(125);
				return dbRef
					.child(
						"users/" +
							uid +
							"/clients/" +
							client_id +
							"/access_token"
					)
					.remove();
			})
			.then(function() {
				//console.log(129);
				return deleteRefreshToken(tokens.refresh_token);
			})
			.then(function() {
				//console.log(133);
				return dbRef
					.child(
						"users/" +
							uid +
							"/clients/" +
							client_id +
							"/refresh_token"
					)
					.remove();
			});
	});
};

// Authorization Code を削除する
const deleteAuthorizationCode = (authorization_code, client_id) => {
	return new Promise(function(resolve, reject) {
		if (authorization_code) {
			dbRef
				.child("authorization_codes/" + authorization_code)
				.remove()
				.then(
					function() {
						//console.log(140);
						resolve();
					},
					function(error) {
						console.log("deleteAuthorizationCode", error);
					}
				);
		} else {
			resolve();
		}
	});
};

// Access Token を削除する
const deleteAccessToken = access_token => {
	return new Promise(function(resolve, reject) {
		if (access_token) {
			dbRef
				.child("access_tokens/" + access_token)
				.remove()
				.then(
					function() {
						resolve();
					},
					function(error) {
						console.log("deleteAccessToken", error);
					}
				);
		} else {
			resolve();
		}
	});
};

// Refresh Token を削除する
const deleteRefreshToken = refresh_token => {
	return new Promise(function(resolve, reject) {
		if (refresh_token) {
			dbRef
				.child("refresh_tokens/" + refresh_token)
				.remove()
				.then(
					function() {
						resolve();
					},
					function(error) {
						console.log("deleteRefreshToken", error);
					}
				);
		} else {
			resolve();
		}
	});
};

// uid から Token 情報を取得する
const getToken_from_UidClientId = (uid, client_id) => {
	return new Promise(function(resolve, reject) {
		dbRef
			.child("users/" + uid + "/clients/" + client_id)
			.once("value")
			.then(
				function(snapshot) {
					let authorization_code = null;
					let access_token = null;
					let refresh_token = null;

					//console.log(397, snapshot.val());

					if (snapshot.val()) {
						authorization_code =
							snapshot.val().authorization_code || null;
						access_token = snapshot.val().access_token || null;
						refresh_token = snapshot.val().refresh_token || null;
					}
					resolve({
						authorization_code: authorization_code,
						access_token: access_token,
						refresh_token: refresh_token
					});
				},
				function(error) {}
			);
	});
};

// ユーザーを削除する
const removeUser = (uid) => {
	return new Promise(function(resolve, reject) {
		getClientlist_from_Uid(uid)
		.then((client_ids)=>{
			clearTokens_Looper(uid, client_ids)
			.then(() => {
				dbRef.child("users/" + uid).remove()
				.then(() => {
					console.log('delete user : ', uid)
					resolve()
				}, (error) => {
					reject(error)
				})
			})
		}, (error) => {
			reject(error)
		})
	})
}

// クライアントをリストで削除
const clearTokens_Looper = (uid, client_ids) => {
	return new Promise(function(resolve, reject) {
		const client_id = client_ids.pop()
		console.log('delete client : ', client_id)

		clearToken(uid, client_id)
		.then(() => {
			if(client_ids.length > 0){
				clearTokens_Looper(uid, client_ids)
				.then(() => {
					resolve()
				}, (error) => {
					reject(error)
				})
			}else{
				resolve()
			}
		},(error) => {
			reject(error)
		})
	})
} 

// uid から Client のリストを返す
const getClientlist_from_Uid = (uid) => {
	return new Promise(function(resolve, reject) {
		dbRef.child("users/" + uid + "/clients").once('value')
		.then((snapshot) => {
			if (snapshot.val()) {
				const keys = Object.keys(snapshot.val())
				resolve(keys)
			}else{
				resolve([])
			}
		}, (error) => {
			reject(error)
		})
	})
}

// ユーザーを削除した時、関連データを削除
AcountLinkApp.deleteUser = (uid) => {
	return new Promise(function(resolve, reject) {
		console.log('deleteUser @ Firebase oAuth2')
		removeUser(uid)
		.then(() => {
			resolve()
		}, (error) => {
			reject(error)
		})
	});
}

// ユーザーを作成した時
AcountLinkApp.createUser = (uid) => {
	return new Promise(function(resolve, reject) {
		console.log('createUser @ Firebase oAuth2')
		resolve()
	});
}

const a = (initializedFirebaseAdmin, _buildin_client = null, dbroot = "AcountLink") => {
	admin = initializedFirebaseAdmin;
	dbRef = admin.database().ref(dbroot);

	if(_buildin_client){
		buildin_client = _buildin_client
	}

	return AcountLinkApp;
};

module.exports = a;