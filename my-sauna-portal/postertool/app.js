// =================================
// SUPABASE
// =================================

const SUPABASE_URL =
    "https://nicpgzkkyktzphkyzhfl.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_-u_XwxwKUozPU086NvvKrg_37sY3yXn";

const supabaseClient =
    supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );


// =================================
// APP STATE
// =================================

const state = {
    devMode: false,
    currentView: null
};


// =================================
// VIEWS
// =================================

const views = {
    mobile:
        document.getElementById(
            "mobile-view"
        ),

    desktop:
        document.getElementById(
            "desktop-view"
        ),

    dev:
        document.getElementById(
            "dev-view"
        )
};


function showView(
    viewName
) {

    Object.values(
        views
    ).forEach(
        view => {

            if (view) {

                view.classList.remove(
                    "active"
                );

            }

        }
    );


    if (!views[viewName]) {

        return;

    }


    views[viewName].classList.add(
        "active"
    );


    state.currentView =
        viewName;


    updateDevInfo();

}


// =================================
// VIEW DETECTION
// =================================

function detectView() {

    if (state.devMode) {

        return;

    }


    if (
        window.innerWidth <= 700
    ) {

        showView(
            "mobile"
        );

    } else {

        showView(
            "desktop"
        );

    }

}


// =================================
// DEV MODE
// ENTER x2
// =================================

let enterCount = 0;
let enterTimer = null;


document.addEventListener(
    "keydown",
    event => {

        if (
            event.key !== "Enter"
        ) {

            return;

        }


        enterCount++;


        clearTimeout(
            enterTimer
        );


        enterTimer =
            setTimeout(
                () => {

                    enterCount = 0;

                },
                500
            );


        if (
            enterCount === 2
        ) {

            enterCount = 0;


            state.devMode =
                !state.devMode;


            if (
                state.devMode
            ) {

                showView(
                    "dev"
                );

            } else {

                detectView();

            }

        }

    }
);


// =================================
// DEV BUTTONS
// =================================

document
    .getElementById(
        "dev-mobile"
    )
    ?.addEventListener(
        "click",
        () => {

            state.devMode =
                true;


            showView(
                "mobile"
            );

        }
    );


document
    .getElementById(
        "dev-desktop"
    )
    ?.addEventListener(
        "click",
        () => {

            state.devMode =
                true;


            showView(
                "desktop"
            );

        }
    );


// =================================
// DEV INFO
// =================================

function updateDevInfo() {

    const viewport =
        document.getElementById(
            "dev-viewport"
        );


    const currentView =
        document.getElementById(
            "dev-current-view"
        );


    if (viewport) {

        viewport.textContent =
            `${window.innerWidth} × ${window.innerHeight}`;

    }


    if (currentView) {

        currentView.textContent =
            state.currentView ||
            "-";

    }

}


// =================================
// RESIZE
// =================================

window.addEventListener(
    "resize",
    () => {

        if (
            !state.devMode
        ) {

            detectView();

        }


        updateDevInfo();

    }
);


// =================================
// SUPABASE DATA
// =================================

async function getParticipants() {

    const {
        data,
        error
    } =
        await supabaseClient
            .from(
                "participants"
            )
            .select("*")
            .order(
                "created_at",
                {
                    ascending: true
                }
            );


    if (error) {

        console.error(
            "Could not load participants:",
            error
        );

        throw error;

    }


    return data;

}


// =================================
// PHOTO URL
// =================================

function getPhotoUrl(
    photoPath
) {

    const {
        data
    } =
        supabaseClient
            .storage
            .from(
                "poster_photos"
            )
            .getPublicUrl(
                photoPath
            );


    return data.publicUrl;

}


// =================================
// LOAD POSTER DATA
// =================================

async function loadPosterData() {

    try {

        const participants =
            await getParticipants();


        setParticipants(
            participants
        );


        /*
            Render the poster AFTER
            Supabase data has arrived.
        */

        renderParticipants();

        renderPoster();


        /*
            Images and poster content
            now exist in the DOM.

            Give the browser a frame to
            calculate the real poster size
            before recalculating FIT/FILL.
        */

        requestAnimationFrame(
            () => {

                window.dispatchEvent(
                    new Event(
                        "resize"
                    )
                );

            }
        );


    } catch (error) {

        console.error(
            "Could not initialize poster:",
            error
        );

    }

}


// =================================
// INIT
// =================================

function init() {

    console.log(
        "Poster Tool starting..."
    );


    /*
        Basic application setup.
    */

    detectView();


    /*
        Preview controls must be
        initialized once.

        FIT/FILL only applies a
        transform to the complete
        poster.
    */

    setupPreviewControls();


    /*
        Title / subtitle inputs.
    */

    setupPosterInputs();


    /*
        CMS tabs + style controls +
        initial poster rendering.
    */

    setupPosterCms();


    /*
        Load actual participants
        from Supabase.
    */

    loadPosterData();

}


// =================================
// DOM READY
// =================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        init();

    }
);