require("dotenv").config();
const {
  OBNIZ_ACCESS_TOKEN,
  OBNIZ_ID,
  AMBIENT_CHANNEL_ID,
  AMBIENT_WRITE_KEY,
} = process.env;
const INTERVAL = 10 * 1000; //10秒おきにスキャン

const obnizNoble = require("obniz-noble");
const ambient = require("ambient-lib");

const noble = obnizNoble(OBNIZ_ID, { access_token: OBNIZ_ACCESS_TOKEN });
ambient.connect(AMBIENT_CHANNEL_ID, AMBIENT_WRITE_KEY);

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
    noble.stopScanning();
  }
});

setInterval(function () {
  console.log("Start scanning..");
  noble.startScanning();
}, INTERVAL);
