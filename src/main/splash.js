
    const video = document.getElementById("intro");
    // Muted so autoplay is never blocked; the intro is silent branding, not
    // something the user needs audio for while the app is still loading.
    let notified = false;
    function notifyEnded() {
      if (notified) return;
      notified = true;
      window.splash?.introEnded();
    }
    video.addEventListener("ended", notifyEnded);
    // If the file fails to load/decode for any reason, don't block startup
    // forever waiting for an "ended" event that will never fire.
    video.addEventListener("error", notifyEnded);
