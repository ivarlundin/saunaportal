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
            "Poster Bastusällskap 2025";

    }


    if (subtitle) {

        subtitle.textContent =
            subtitleValue ||
            "– Vem är vem? –";

    }


    // =================================
    // GRID STYLE
    // =================================

    const columns =
        posterState.style?.columns ?? 4;

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
    // GRID CONTENT
    // =================================

    grid.innerHTML = "";


    const visibleParticipants =
        posterState.participants.filter(
            participant =>
                participant.visible !== false
        );


    visibleParticipants.forEach(
        (
            participant,
            visibleIndex
        ) => {

            const person =
                document.createElement(
                    "div"
                );


            person.className =
                "poster-person";


            person.dataset.visibleIndex =
                visibleIndex;


            // =================================
            // IMAGE
            // =================================

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


            // =================================
            // NAME
            // =================================

            const name =
                document.createElement(
                    "div"
                );


            name.className =
                "poster-person-name";


            name.textContent =
                participant.name || "";


            // =================================
            // CONTROLS
            // =================================

            const controls =
                document.createElement(
                    "div"
                );


            controls.className =
                "poster-person-controls";


            // =================================
            // VISIBILITY
            // =================================

            const visibilityButton =
                document.createElement(
                    "button"
                );


            visibilityButton.className =
                "poster-visibility-button";


            visibilityButton.type =
                "button";


            visibilityButton.title =
                "Göm person";


            visibilityButton.textContent =
                "👁";


            visibilityButton.addEventListener(
                "click",
                event => {

                    event.preventDefault();
                    event.stopPropagation();


                    participant.visible =
                        false;


                    renderParticipants();
                    renderPoster();

                }
            );


            // =================================
            // DRAG HANDLE
            // =================================

            const dragHandle =
                document.createElement(
                    "div"
                );


            dragHandle.className =
                "poster-drag-handle";


            dragHandle.textContent =
                "☰";


            dragHandle.title =
                "Dra för att ändra ordning";


            dragHandle.addEventListener(
                "mousedown",
                event => {

                    event.stopPropagation();

                }
            );


            // =================================
            // BUILD
            // =================================

            controls.appendChild(
                visibilityButton
            );

            controls.appendChild(
                dragHandle
            );


            person.appendChild(
                image
            );

            person.appendChild(
                name
            );

            person.appendChild(
                controls
            );


            grid.appendChild(
                person
            );

        }
    );


    setupPosterPreviewDrag();

}


// =================================
// POSTER PREVIEW DRAG & DROP
// =================================

function setupPosterPreviewDrag() {

    const grid =
        document.getElementById(
            "poster-grid"
        );


    if (!grid) {
        return;
    }


    const people =
        grid.querySelectorAll(
            ".poster-person"
        );


    let draggedVisibleIndex =
        null;


    people.forEach(
        person => {

            person.draggable =
                true;


            person.addEventListener(
                "dragstart",
                event => {

                    draggedVisibleIndex =
                        Number(
                            person.dataset.visibleIndex
                        );


                    person.classList.add(
                        "poster-dragging"
                    );


                    if (event.dataTransfer) {

                        event.dataTransfer.effectAllowed =
                            "move";


                        event.dataTransfer.setData(
                            "text/plain",
                            String(
                                draggedVisibleIndex
                            )
                        );

                    }

                }
            );


            person.addEventListener(
                "dragend",
                () => {

                    person.classList.remove(
                        "poster-dragging"
                    );


                    clearPosterDropIndicator();


                    draggedVisibleIndex =
                        null;

                }
            );


            person.addEventListener(
                "dragover",
                event => {

                    event.preventDefault();


                    if (
                        draggedVisibleIndex === null
                    ) {

                        return;

                    }


                    const targetVisibleIndex =
                        Number(
                            person.dataset.visibleIndex
                        );


                    if (
                        draggedVisibleIndex ===
                        targetVisibleIndex
                    ) {

                        clearPosterDropIndicator();

                        return;

                    }


                    const rect =
                        person.getBoundingClientRect();


                    const middle =
                        rect.left +
                        rect.width / 2;


                    clearPosterDropIndicator();


                    person.classList.add(
                        event.clientX < middle
                            ? "poster-drop-before"
                            : "poster-drop-after"
                    );

                }
            );


            person.addEventListener(
                "drop",
                event => {

                    event.preventDefault();


                    if (
                        draggedVisibleIndex === null
                    ) {

                        return;

                    }


                    const targetVisibleIndex =
                        Number(
                            person.dataset.visibleIndex
                        );


                    if (
                        draggedVisibleIndex ===
                        targetVisibleIndex
                    ) {

                        clearPosterDropIndicator();

                        return;

                    }


                    const rect =
                        person.getBoundingClientRect();


                    const middle =
                        rect.left +
                        rect.width / 2;


                    let insertVisibleIndex =
                        targetVisibleIndex;


                    if (
                        event.clientX >= middle
                    ) {

                        insertVisibleIndex =
                            targetVisibleIndex + 1;

                    }


                    moveParticipantFromPreview(
                        draggedVisibleIndex,
                        insertVisibleIndex
                    );


                    clearPosterDropIndicator();

                }
            );

        }
    );

}


// =================================
// MOVE PARTICIPANT
// =================================

function moveParticipantFromPreview(
    fromVisibleIndex,
    toVisibleIndex
) {

    const participants =
        posterState.participants;


    const visibleParticipants =
        participants.filter(
            participant =>
                participant.visible !== false
        );


    const movedParticipant =
        visibleParticipants[
            fromVisibleIndex
        ];


    if (!movedParticipant) {
        return;
    }


    const fromRealIndex =
        participants.indexOf(
            movedParticipant
        );


    if (fromRealIndex === -1) {
        return;
    }


    participants.splice(
        fromRealIndex,
        1
    );


    const remainingVisible =
        participants.filter(
            participant =>
                participant.visible !== false
        );


    toVisibleIndex =
        Math.max(
            0,
            Math.min(
                toVisibleIndex,
                remainingVisible.length
            )
        );


    const targetParticipant =
        remainingVisible[
            toVisibleIndex
        ];


    if (targetParticipant) {

        const targetRealIndex =
            participants.indexOf(
                targetParticipant
            );


        participants.splice(
            targetRealIndex,
            0,
            movedParticipant
        );

    } else {

        participants.push(
            movedParticipant
        );

    }


    renderParticipants();
    renderPoster();

}


// =================================
// CLEAR DROP INDICATOR
// =================================

function clearPosterDropIndicator() {

    document
        .querySelectorAll(
            ".poster-drop-before, .poster-drop-after"
        )
        .forEach(
            element => {

                element.classList.remove(
                    "poster-drop-before",
                    "poster-drop-after"
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


    const stage =
        document.querySelector(
            ".preview-stage"
        );


    const scaleElement =
        document.querySelector(
            ".poster-scale"
        );


    if (
        !stage ||
        !scaleElement
    ) {

        return;

    }


    // =================================
    // CURRENT MODE
    // =================================

    let mode =
        "fit";


    // =================================
    // UPDATE
    // =================================

    function updatePreviewScale() {

        const posterWidth =
            scaleElement.offsetWidth;


        const posterHeight =
            scaleElement.offsetHeight;


        const stageWidth =
            stage.clientWidth;


        const stageHeight =
            stage.clientHeight;


        if (
            posterWidth <= 0 ||
            posterHeight <= 0 ||
            stageWidth <= 0 ||
            stageHeight <= 0
        ) {

            return;

        }


        // =================================
        // FIT
        // =================================

        if (
            mode === "fit"
        ) {

            const scale =
                Math.min(
                    stageWidth / posterWidth,
                    stageHeight / posterHeight
                );


            stage.classList.remove(
                "preview-fill"
            );


            scaleElement.style.setProperty(
                "--preview-scale",
                scale
            );


            return;

        }


        // =================================
        // FILL
        // =================================

        /*
            FILL = width of stage.

            We DO NOT use height here.

            Since A4 is 210:297, the poster
            becomes taller than the stage.

            The stage scrolls vertically.
        */

        const scale =
            stageWidth / posterWidth;


        stage.classList.add(
            "preview-fill"
        );


        scaleElement.style.setProperty(
            "--preview-scale",
            scale
        );

    }


    // =================================
    // SET MODE
    // =================================

    function setMode(
        newMode
    ) {

        mode =
            newMode;


        fitButton?.classList.toggle(
            "active",
            mode === "fit"
        );


        fillButton?.classList.toggle(
            "active",
            mode === "fill"
        );


        updatePreviewScale();

    }


    // =================================
    // FIT
    // =================================

    fitButton?.addEventListener(
        "click",
        () => {

            setMode("fit");

        }
    );


    // =================================
    // FILL
    // =================================

    fillButton?.addEventListener(
        "click",
        () => {

            setMode("fill");

        }
    );


    // =================================
    // RESIZE
    // =================================

    window.addEventListener(
        "resize",
        () => {

            updatePreviewScale();

        }
    );


    // =================================
    // INITIAL
    // =================================

    setMode("fit");

}


// =================================
// TITLE INPUTS
// =================================

function setupPosterInputs() {

    const titleInput =
        document.getElementById(
            "poster-title"
        );


    const subtitleInput =
        document.getElementById(
            "poster-subtitle"
        );


    titleInput?.addEventListener(
        "input",
        renderPoster
    );


    subtitleInput?.addEventListener(
        "input",
        renderPoster
    );

}


// =================================
// PRINT / PDF
// =================================

function setupPosterPrint() {

    const printButton =
        document.getElementById("print-pdf");


    if (!printButton) {
        return;
    }


    printButton.addEventListener(
        "click",
        () => {

            window.print();

        }
    );

}


// =================================
// INIT PRINT
// =================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupPosterPrint();

    }
);