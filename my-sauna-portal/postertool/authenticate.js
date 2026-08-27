/* =========================================================
   AUTHENTICATION
   ========================================================= */


/* =========================================================
   SETTINGS
   ========================================================= */

const AUTH_DURATION =
    24 * 60 * 60 * 1000;

const AUTH_STORAGE_KEY =
    "event-auth";


/* =========================================================
   SUPABASE
   ========================================================= */

const SUPABASE_ANON_KEY =
    "sb_publishable_-u_XwxwKUozPU086NvvKrg_37sY3yXn";

const AUTH_FUNCTION_URL =
    "https://nicpgzkkyktzphkyzhfl.supabase.co/functions/v1/check-event-password";


/* =========================================================
   CHECK PASSWORD
   ========================================================= */

async function checkPassword(password) {

    try {

        const response = await fetch(
            AUTH_FUNCTION_URL,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json",

                    "Authorization":
                        `Bearer ${SUPABASE_ANON_KEY}`,

                    "apikey":
                        SUPABASE_ANON_KEY
                },

                body: JSON.stringify({
                    password: password
                })
            }
        );


        const data =
            await response.json();


        console.log(
            "Auth response:",
            {
                status: response.status,
                ok: response.ok,
                data: data
            }
        );


        return data.success === true;

    } catch (error) {

        console.error(
            "Authentication error:",
            error
        );

        return false;
    }
}


/* =========================================================
   CHECK LOCAL AUTH
   ========================================================= */

function isAuthenticated() {

    const loginTime =
        localStorage.getItem(
            AUTH_STORAGE_KEY
        );


    if (!loginTime) {
        return false;
    }


    const timestamp =
        Number(loginTime);


    /*
     * Invalid timestamp.
     */

    if (!Number.isFinite(timestamp)) {

        logout(false);

        return false;
    }


    const age =
        Date.now() - timestamp;


    /*
     * System clock moved backwards.
     */

    if (age < 0) {

        logout(false);

        return false;
    }


    /*
     * 24 hour session expired.
     */

    if (age > AUTH_DURATION) {

        logout(false);

        return false;
    }


    return true;
}


/* =========================================================
   LOGIN
   ========================================================= */

async function login(password) {

    if (!password) {
        return false;
    }


    const correct =
        await checkPassword(password);


    if (!correct) {
        return false;
    }


    /*
     * Store only the login timestamp.
     *
     * The password itself is NEVER stored.
     */

    localStorage.setItem(
        AUTH_STORAGE_KEY,
        Date.now().toString()
    );


    return true;
}


/* =========================================================
   LOGOUT
   ========================================================= */

function logout(reload = true) {

    localStorage.removeItem(
        AUTH_STORAGE_KEY
    );


    if (reload) {
        window.location.reload();
    }
}


/* =========================================================
   SHOW AUTHENTICATED APP
   ========================================================= */

function showAuthenticatedApp() {

    const authView =
        document.getElementById(
            "auth-view"
        );


    /*
     * Hide login screen.
     */

    if (authView) {

        authView.classList.remove(
            "active"
        );

        authView.style.display =
            "none";
    }


    /*
     * Tell the rest of the application
     * that authentication is complete.
     */

    document.dispatchEvent(
        new CustomEvent(
            "authenticated"
        )
    );
}


/* =========================================================
   SHOW LOGIN
   ========================================================= */

function showLogin() {

    const authView =
        document.getElementById(
            "auth-view"
        );


    if (!authView) {
        return;
    }


    authView.classList.add(
        "active"
    );

    authView.style.display =
        "flex";
}


/* =========================================================
   AUTH VIEW
   ========================================================= */

function setupAuthentication() {

    const authView =
        document.getElementById(
            "auth-view"
        );

    const authButton =
        document.getElementById(
            "auth-button"
        );

    const passwordInput =
        document.getElementById(
            "auth-password"
        );

    const authStatus =
        document.getElementById(
            "auth-status"
        );


    /*
     * Make sure auth HTML exists.
     */

    if (
        !authView ||
        !authButton ||
        !passwordInput
    ) {

        console.error(
            "Authentication elements missing."
        );

        return;
    }


    /* =====================================================
       ALREADY AUTHENTICATED
       ===================================================== */

    if (isAuthenticated()) {

        showAuthenticatedApp();

        return;
    }


    /* =====================================================
       NOT AUTHENTICATED
       ===================================================== */

    showLogin();


    /* =====================================================
       LOGIN HANDLER
       ===================================================== */

    async function handleLogin() {

        const password =
            passwordInput.value.trim();


        /*
         * Empty password.
         */

        if (!password) {

            if (authStatus) {

                authStatus.textContent =
                    "Skriv in lösenordet.";
            }

            passwordInput.focus();

            return;
        }


        /*
         * Prevent multiple requests.
         */

        authButton.disabled =
            true;


        if (authStatus) {

            authStatus.textContent =
                "Kontrollerar...";
        }


        const success =
            await login(password);


        /* =================================================
           LOGIN FAILED
           ================================================= */

        if (!success) {

            if (authStatus) {

                authStatus.textContent =
                    "Fel lösenord.";
            }


            passwordInput.value =
                "";


            passwordInput.focus();


            authButton.disabled =
                false;


            return;
        }


        /* =================================================
           LOGIN SUCCESSFUL
           ================================================= */

        if (authStatus) {

            authStatus.textContent =
                "";
        }


        /*
         * Reload the application.
         *
         * On reload:
         *
         * isAuthenticated()
         *        ↓
         * true
         *        ↓
         * showAuthenticatedApp()
         */

        window.location.reload();
    }


    /* =====================================================
       LOGIN BUTTON
       ===================================================== */

    authButton.addEventListener(
        "click",
        handleLogin
    );


    /* =====================================================
       ENTER KEY
       ===================================================== */

    passwordInput.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key === "Enter" &&
                !authButton.disabled
            ) {

                handleLogin();
            }

        }
    );


    /* =====================================================
       LOGOUT BUTTON
       ===================================================== */

    const logoutButton =
        document.getElementById(
            "logout-button"
        );


    if (logoutButton) {

        logoutButton.addEventListener(
            "click",
            () => {

                logout(true);

            }
        );
    }

}


/* =========================================================
   AUTH TIMEOUT
   ========================================================= */

function setupAuthTimeout() {

    /*
     * No timeout if not authenticated.
     */

    if (!isAuthenticated()) {
        return;
    }


    const loginTime =
        Number(
            localStorage.getItem(
                AUTH_STORAGE_KEY
            )
        );


    if (!Number.isFinite(loginTime)) {
        return;
    }


    const elapsed =
        Date.now() - loginTime;


    const remaining =
        AUTH_DURATION - elapsed;


    /*
     * Already expired.
     */

    if (remaining <= 0) {

        logout(true);

        return;
    }


    /*
     * Automatically logout when
     * the 24 hour session expires.
     */

    setTimeout(
        () => {

            logout(true);

        },
        remaining
    );

}


/* =========================================================
   INITIALIZE AUTH
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupAuthentication();

        setupAuthTimeout();

    }
);