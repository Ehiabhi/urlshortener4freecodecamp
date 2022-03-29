require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const dns = require("dns");
const URL = require("url").URL; //Test url validity
var ids = require("short-id");
const cors = require("cors");
let mongoose;
try {
  mongoose = require("mongoose");
} catch (e) {
  console.log(e);
}

// Basic Configuration
const app = express();
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const urlSchema = new mongoose.Schema({
  original_url: String,
  short_url: String,
});
let Url = mongoose.model("Url", urlSchema);
const port = process.env.PORT || 3000;
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cors());
app.use("/public", express.static(`${process.cwd()}/public`));

// Used to test if a string is valid URL.
const stringIsAValidUrl = (s) => {
  try {
    new URL(s);
    return true;
  } catch (err) {
    return false;
  }
};

// Routes Declaration
app.get("/", function (req, res) {
  res.sendFile(process.cwd() + "/views/index.html");
});

// Your first API endpoint
app.get("/api/hello", function (req, res) {
  res.json({ greeting: "hello API" });
});

app.get("/api/shorturl/:url", function (req, res) {
  const short_url = req.params.url;
  Url.findOne({ short_url }, function (err, result) {
    if (err) {
      res.json({ error: "Error while searching for a url match." });
    } else {
      if (result) {
        res.redirect(result.original_url);
      } else {
        res.json({ error: "Error while fetching url from db." });
      }
    }
  });
});

app.post("/api/shorturl", function (req, res) {
  let val = false;
  let original_url = req.body.url;
  let urlForDnsTest;
  if (!/^https:\/\/|http:\/\//.test(original_url)) {
    res.json({ error: "invalid url" });
  } else {
    // Remove "https:// or http://" at the start of the url string if it exist as dns module doesn't process urls with such characters
    if (/^http/.test(original_url)) {
      urlForDnsTest = original_url.slice(original_url.indexOf("/") + 2);
    }
    // Remove "/" at the end of the url string if it exist as dns module doesn't process urls with such characters
    if (/\/$/.test(original_url)) {
      urlForDnsTest = original_url.slice(0, original_url.length - 1);
    }

    dns.lookup(urlForDnsTest, { family: 4 }, function (err, address, family) {
      if (
        family !== "4" &&
        !/^[\d]{1,3}.[\d]{1,3}.[\d]{1,3}.[\d]{1,3}$/.test(address)
      ) {
        val = true;
      }
    });

    if (val) {
      res.json({ error: "Invalid Hostname" });
    } else {
      Url.findOne({ original_url: original_url }, function (err, result) {
        if (err) {
          res.json({ error: "Error while searching db." });
        } else {
          if (result) {
            res.json({
              original_url: result.original_url,
              short_url: result.short_url,
            });
          } else {
            const short_url = ids.generate();
            const url = new Url({
              original_url,
              short_url,
            });
            url.save(function (err) {
              if (err) {
                res.json({ error: "Error while saving new entry." });
              } else {
                Url.findOne({ original_url }, function (err, result) {
                  if (err) {
                    res.json({
                      error:
                        "Error while searching db for newly created entry.",
                    });
                  } else {
                    if (result) {
                      res.json({
                        original_url: result.original_url,
                        short_url: result.short_url,
                      });
                    } else {
                      res.json({
                        error:
                          "Entry created and saved but couldn't be retrieved from db.",
                      });
                    }
                  }
                });
              }
            });
          }
        }
      });
    }
  }
});

app.listen(port, function () {
  console.log(`Listening on port ${port}`);
});
