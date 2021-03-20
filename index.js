require("dotenv").config();
const {
  OBNIZ_ACCESS_TOKEN,
  OBNIZ_ID,
  AMBIENT_CHANNEL_ID,
  AMBIENT_WRITE_KEY,
  FIRESTORE_API_KEY,
  FIRESTORE_APP_ID,
  FIRESTORE_PROJECT_ID,
  FIRESTORE_MEASUREMENT_ID,
  FIRESTORE_COLLECTION_ID,
  FIRESTORE_MESSAGING_SENDER_ID,
} = process.env;
const INTERVAL = 10 * 1000; // 10秒おきにスキャン
const BUTTON_RESET = 10 * 1000; // 10秒でボタンをリセット

const obnizNoble = require("obniz-noble");
const ambient = require("ambient-lib");

const firebase = require("firebase/app");
require("firebase/auth");
require("firebase/firestore");

// hmm... 2 connection:<
// if you use noble and defalut obniz
const noble = obnizNoble(OBNIZ_ID, { access_token: OBNIZ_ACCESS_TOKEN });
const obniz = new obnizNoble.Obniz.M5StickC(OBNIZ_ID, {
  access_token: OBNIZ_ACCESS_TOKEN,
});
ambient.connect(AMBIENT_CHANNEL_ID, AMBIENT_WRITE_KEY);
const app = firebase.initializeApp({
  apiKey: FIRESTORE_API_KEY,
  authDomain: `${FIRESTORE_PROJECT_ID}.firebaseapp.com`,
  appId: FIRESTORE_APP_ID,
  projectId: FIRESTORE_PROJECT_ID,
  storageBucket: `${FIRESTORE_PROJECT_ID}.appspot.com`,
  messagingSenderId: FIRESTORE_MESSAGING_SENDER_ID,
  measurementId: FIRESTORE_MEASUREMENT_ID,
  databaseURL: `https://${FIRESTORE_PROJECT_ID}.firebaseio.com`,
});
const db = app.firestore();

noble.on("stateChange", function (state) {
  if (state === "poweredOn") {
    noble.startScanning();
  } else {
    noble.stopScanning();
  }
});

noble.on("scanStart", function () {
  console.log("scanStart");
});

noble.on("scanStop", function () {
  console.log("scanStop");
});

noble.on("discover", function (peripheral) {
  var buf = peripheral.advertisement.manufacturerData;
  if (peripheral.advertisement.localName == "sps") {
    var t = buf.readInt16LE(0) / 100;
    var h = buf.readInt16LE(2) / 100;
    var b = buf[7];
    console.log(
      "[discover IBS-TH1] temp:" +
        t +
        " degree, humidity:" +
        h +
        "%, battery:" +
        b +
        "%\n"
    );
    ambient.send({ d1: t, d2: h, d3: b }, function (err, res, body) {
      if (err) {
        console.log(err);
      }
      console.log(`AmbientRespose is: ${res ? res.statusCode : "unknown"}`);
    });
    const data = {
      temperature: t,
      humidity: h,
      battery: b,
    };
    sensorId = peripheral.address ? peripheral.address : "dummyId";
    db.collection(FIRESTORE_COLLECTION_ID)
      .doc(sensorId)
      .update(data)
      .then(() => {
        console.log("Frank created");
      })
      .catch((e) => {
        console.log(e);
      });
    noble.stopScanning();
  }
});

setInterval(function () {
  console.log("Start scanning..");
  noble.startScanning();
}, INTERVAL);

let sensorId;
let buttonStatus = false;
obniz.onconnect = async function () {
  obniz.buttonA.onchange = (pressed) => {
    if (sensorId && pressed && !buttonStatus) {
      db.collection(FIRESTORE_COLLECTION_ID)
        .doc(sensorId)
        .update({ pressed: true })
        .then(() => {
          console.log("ButtonStatus updated");
          buttonStatus = true;
          setTimeout(function () {
            if (buttonStatus) {
              db.collection(FIRESTORE_COLLECTION_ID)
                .doc(sensorId)
                .update({ pressed: false })
                .then(() => {
                  console.log("ButtonStatus reseted");
                  buttonStatus = false;
                })
                .catch((e) => {
                  console.log(e);
                });
            }
          }, BUTTON_RESET);
        })
        .catch((e) => {
          console.log(e);
        });
    }
  };
};
