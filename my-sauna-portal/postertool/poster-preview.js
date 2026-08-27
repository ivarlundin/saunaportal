// =================================
// POSTER PREVIEW
// =================================

function renderPoster() {

    const grid =
        document.getElementById(
            "poster-grid"
        );

    const title =
        document.getElementById(
            "preview-title"
        );

    const subtitle =
        document.getElementById(
            "preview-subtitle"
        );

    const titleInput =
        document.getElementById(
            "poster-title"
        );

    const subtitleInput =
        document.getElementById(
            "poster-subtitle"
        );


    if (!grid) {
        return;
    }


    // =================================
    // TITLE
    // =================================

    const titleValue =
        titleInput?.value.trim();

    const subtitleValue =
        subtitleInput?.value.trim();


    if (title) {

        title.textContent =
            titleValue ||
            "Möckelsnäs Bastusällskap 2025";

    }


    if (subtitle) {

        subtitle.textContent =
            subtitleValue ||
            "– Vem är vem? –";

    }


    // =================================
    // GRID
    // =================================

    grid.innerHTML = "";


    posterState.participants
        .filter(
            participant =>
                participant.visible
        )
        .forEach(
            participant => {

                const person =
                    document.createElement(
                        "div"
                    );

                person.className =
                    "poster-person";


                const image =
                    document.createElement(
                        "img"
                    );

                image.src =
                    getPhotoUrl(
                        participant.photo_path
                    );

                image.alt =
                    participant.name;


                const name =
                    document.createElement(
                        "div"
                    );

                name.className =
                    "poster-person-name";

                name.textContent =
                    participant.name;


                person.appendChild(
                    image
                );

                person.appendChild(
                    name
                );


                grid.appendChild(
                    person
                );

            }
        );
}


// =================================
// PREVIEW MODE
// =================================

function setupPreviewControls() {

    const fitButton =
        document.getElementById(
            "preview-fit"
        );

    const fillButton =
        document.getElementById(
            "preview-fill"
        );

    const poster =
        document.getElementById(
            "poster-preview"
        );


    function setMode(mode) {

        if (!poster) {
            return;
        }


        poster.classList.remove(
            "preview-fit",
            "preview-fill"
        );


        poster.classList.add(
            `preview-${mode}`
        );


        fitButton?.classList.toggle(
            "active",
            mode === "fit"
        );

        fillButton?.classList.toggle(
            "active",
            mode === "fill"
        );
    }


    fitButton?.addEventListener(
        "click",
        () => setMode("fit")
    );


    fillButton?.addEventListener(
        "click",
        () => setMode("fill")
    );


    setMode("fit");
}


// =================================
// TITLE INPUTS
// =================================

function setupPosterInputs() {

    document
        .getElementById(
            "poster-title"
        )
        ?.addEventListener(
            "input",
            renderPoster
        );


    document
        .getElementById(
            "poster-subtitle"
        )
        ?.addEventListener(
            "input",
            renderPoster
        );
}