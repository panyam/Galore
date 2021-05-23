import express = require("express");
import * as TSG from "@panyam/tsutils-gae";

const router = express.Router();
const wrapAsync = (fn: any) => (...args: any[]) => Promise.resolve(fn(...args)).catch(args[2]);

router.get("/logout(/)?", TSG.Auth.ensureLogin(), function (req: any, res: any, next: any) {
  req.logout();
  if (req.session) {
    req.session.destroy();
  }
  res.redirect("/");
});

router.get("/me(/)?", TSG.Auth.ensureLogin(), function (req: any, res: any, next: any) {
  const userID = req.session.loggedInUser.id;
  res.render("me/index.html", {
    userId: userID,
    title: "Me",
    pageHeading: "Me",
  });
});

/* GET home page. */
router.get("/", function (req: any, res: any, next: any) {
  const userID = req.session?.loggedInUser?.id || null;
  res.render("homepage/index.html", {
    title: "Homepage",
    h1: "Welcome",
    userId: userID,
  });
});

module.exports = router;
