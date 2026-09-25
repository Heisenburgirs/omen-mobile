// Runs before the app. External rather than inline so the page's
// Content-Security-Policy needs no 'unsafe-inline' for scripts.
(function () {
  var ua = navigator.userAgent || "";
  var gate = document.getElementById("gate"), card = document.getElementById("gate-card");
  var skip = function (key) { try { return sessionStorage.getItem(key) === "1"; } catch (e) { return false; } };
  var remember = function (key) { try { sessionStorage.setItem(key, "1"); } catch (e) {} };
  var show = function (html) { card.innerHTML = html; gate.style.display = "flex"; };
  var hide = function () { gate.style.display = "none"; };
  // A sign-in coming back from Google or X must land in the app itself.
  var returning = /[?&]privy_oauth_/.test(location.search);
  // In-app browsers (X, Instagram, Facebook, TikTok, LinkedIn, Line, Telegram):
  // Google answers their sign-in with "disallowed_useragent".
  var inApp = /Twitter|FBAN|FBAV|Instagram|TikTok|musical_ly|LinkedInApp|Line\/|Telegram|Snapchat/i.test(ua);
  if (inApp && !returning && !skip("omen.inapp")) {
    var android = /Android/i.test(ua);
    var open = android
      ? "intent://www.getomen.xyz/app#Intent;scheme=https;action=android.intent.action.VIEW;end"
      : "x-safari-https://www.getomen.xyz/app";
    show(
      "<h1>Open OMEN in your browser</h1>" +
      "<p>You are inside another app's browser, where Google sign-in is blocked. Open OMEN in " +
      (android ? "Chrome" : "Safari") + " for the full app. Signing in with X works here too.</p>" +
      '<a class="primary" href="' + open + '">Open in ' + (android ? "Chrome" : "Safari") + "</a>" +
      '<button class="quiet" id="gate-skip">Continue here</button>'
    );
    document.getElementById("gate-skip").onclick = function () { remember("omen.inapp"); hide(); };
    return;
  }
  var phone = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  // "Download web app" on the landing page: the install prompt is Chrome's
  // and only the app's own page may raise it (the manifest's scope), so the
  // landing sends people here with ?install=1 and this asks on their behalf.
  // The event arrives a moment after load, when Chrome has checked the
  // manifest; a browser that never sends it (Safari, Firefox) gets the
  // menu steps instead.
  var standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  var wantsInstall = /[?&]install=1/.test(location.search) && !returning && !standalone;
  var deferred = null;
  addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferred = e; });
  addEventListener("appinstalled", function () { hide(); });
  if (wantsInstall && phone) {
    try { history.replaceState(null, "", location.pathname); } catch (e) {}
    var ios = /iPhone|iPad|iPod/i.test(ua);
    var steps = ios
      ? "Tap <b>Share</b> in Safari, then <b>Add to Home Screen</b>."
      : "Open the browser menu (⋮), then tap <b>Add to Home screen</b> or <b>Install app</b>.";
    var manual = function () {
      show(
        "<h1>Add OMEN to your home screen</h1>" +
        "<p>" + steps + " It opens full screen, like an app.</p>" +
        '<button class="quiet" id="gate-skip">Continue in browser</button>'
      );
      document.getElementById("gate-skip").onclick = hide;
    };
    var ask = function () {
      if (!deferred) return manual();
      var prompt = deferred;
      deferred = null;
      prompt.prompt();
      prompt.userChoice.then(function (choice) { if (choice.outcome !== "accepted") hide(); }, hide);
    };
    show(
      "<h1>Install OMEN</h1>" +
      "<p>Add it to your home screen: it opens full screen and stays signed in.</p>" +
      '<button class="primary" id="gate-install">Install</button>' +
      '<button class="quiet" id="gate-skip">Continue in browser</button>'
    );
    document.getElementById("gate-install").onclick = ask;
    document.getElementById("gate-skip").onclick = hide;
    return;
  }
  if (!phone && innerWidth > 700 && !returning && !skip("omen.desktop")) {
    show(
      "<h1>OMEN is a phone app</h1>" +
      "<p>Scan to open it on your phone. No install needed.</p>" +
      '<img alt="QR code for www.getomen.xyz/app" src="/app/qr-app.png" />' +
      '<button class="quiet" id="gate-skip">Continue on this computer</button>'
    );
    document.getElementById("gate-skip").onclick = function () { remember("omen.desktop"); hide(); };
  }
})();

if ("serviceWorker" in navigator)
  addEventListener("load", function () {
    navigator.serviceWorker.register("/app/sw.js", { scope: "/app" }).catch(function () {});
  });
