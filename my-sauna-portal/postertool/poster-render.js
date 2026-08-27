// =================================
// POSTER RENDER
// =================================

function renderPoster() {

    const poster =
        document.getElementById(
            "poster-preview"
        );


    if (!poster) {
        return;
    }


    // =================================
    // CLEAR POSTER
    // =================================

    poster.innerHTML = "";


    // =================================
    // POSTER TOP
    // =================================

    const top =
        document.createElement(
            "div"
        );

    top.className =
        "poster-top";


    // =================================
    // SAUNA IMAGE
    // =================================

    const sauna =
        document.createElement(
            "div"
        );

    sauna.className =
        "poster-sauna";


    const saunaImage =
        document.createElement(
            "img"
        );

    saunaImage.src =
        "assets/sauna.png";

    saunaImage.alt =
        "";


    sauna.appendChild(
        saunaImage
    );


    // =================================
    // HEADER
    // =================================

    const header =
        document.createElement(
            "div"
        );

    header.className =
        "poster-header";


    const title =
        document.createElement(
            "h1"
        );

    title.textContent =
        posterState.title || "";


    const subtitle =
        document.createElement(
            "p"
        );

    subtitle.textContent =
        posterState.subtitle || "";


    header.appendChild(
        title
    );

    header.appendChild(
        subtitle
    );


    top.appendChild(
        sauna
    );

    top.appendChild(
        header
    );


    // =================================
    // PARTICIPANT GRID
    // =================================

    const grid =
        document.createElement(
            "div"
        );

    grid.className =
        "poster-grid";


    const columns =
        posterState.style?.columns || 4;


    const gap =
        posterState.style?.gap ?? 5;


    grid.style.setProperty(
        "--poster-columns",
        columns
    );


    grid.style.setProperty(
        "--poster-gap",
        `${gap}mm`
    );


    // =================================
    // PARTICIPANTS
    // =================================

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

                image.className =
                    "poster-person-image";

                image.src =
                    getPhotoUrl(
                        participant.photo_path
                    );

                image.alt =
                    participant.name || "";


                const name =
                    document.createElement(
                        "div"
                    );

                name.className =
                    "poster-person-name";

                name.textContent =
                    participant.name || "";


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


    // =================================
    // POSTER BOTTOM
    // =================================

    const bottom =
        document.createElement(
            "div"
        );

    bottom.className =
        "poster-bottom";


    const logos =
        document.createElement(
            "div"
        );

    logos.className =
        "poster-logos";


    bottom.appendChild(
        logos
    );


    // =================================
    // BUILD POSTER
    // =================================

    poster.appendChild(
        top
    );

    poster.appendChild(
        grid
    );

    poster.appendChild(
        bottom
    );

}