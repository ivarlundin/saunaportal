(function () {
    var ua = navigator.userAgent || "";

    if (/Android/i.test(ua)) {
        document.documentElement.classList.add("android");
    }
})();
