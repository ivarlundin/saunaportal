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
                participant.visible
        );


    visibleParticipants.forEach(
        (
            participant,
            visibleIndex
        ) => {

            // =================================
            // PERSON
            // =================================

            const person =
                document.createElement(
                    "div"
                );


            person.className =
                "poster-person";


            /*
                This is the index inside the
                visible poster list.

                Hidden participants are NOT
                included here.
            */

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
                participant.name;


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
                participant.name;


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
            // VISIBILITY BUTTON
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


            visibilityButton.setAttribute(
                "aria-label",
                `Göm ${participant.name}`
            );


            visibilityButton.textContent =
                "👁";


            // =================================
            // VISIBILITY CLICK
            // =================================

            visibilityButton.addEventListener(
                "click",
                event => {

                    /*
                        IMPORTANT:

                        Prevent the button click
                        from starting drag.
                    */

                    event.preventDefault();

                    event.stopPropagation();


                    participant.visible =
                        false;


                    // Update CMS
                    renderParticipants();


                    // Update poster
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


            dragHandle.title =
                "Dra för att ändra ordning";


            dragHandle.setAttribute(
                "aria-label",
                `Flytta ${participant.name}`
            );


            dragHandle.textContent =
                "☰";


            /*
                Prevent the handle itself from
                behaving like a normal button.
            */

            dragHandle.addEventListener(
                "mousedown",
                event => {

                    event.stopPropagation();

                }
            );


            // =================================
            // BUILD CONTROLS
            // =================================

            controls.appendChild(
                visibilityButton
            );


            controls.appendChild(
                dragHandle
            );


            // =================================
            // BUILD PERSON
            // =================================

            person.appendChild(
                image
            );


            person.appendChild(
                name
            );


            person.appendChild(
                controls
            );


            // =================================
            // ADD TO GRID
            // =================================

            grid.appendChild(
                person
            );

        }
    );


    /*
        renderPoster() destroys and recreates
        all poster-person elements.

        Therefore drag listeners need to be
        attached again.
    */

    setupPosterPreviewDrag();

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
    // DEFAULT
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

            // =================================
            // DRAGGABLE
            // =================================

            person.draggable =
                true;


            // =================================
            // DRAG START
            // =================================

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


                    if (
                        event.dataTransfer
                    ) {

                        event.dataTransfer.effectAllowed =
                            "move";


                        /*
                            Firefox needs some
                            transferable data for
                            reliable dragging.
                        */

                        event.dataTransfer.setData(
                            "text/plain",
                            String(
                                draggedVisibleIndex
                            )
                        );

                    }

                }
            );


            // =================================
            // DRAG END
            // =================================

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


            // =================================
            // DRAG OVER
            // =================================

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


                    /*
                        Do not show an indicator
                        on the dragged item itself.
                    */

                    if (
                        draggedVisibleIndex ===
                        targetVisibleIndex
                    ) {

                        clearPosterDropIndicator();

                        return;

                    }


                    const rect =
                        person.getBoundingClientRect();


                    /*
                        Determine whether the
                        cursor is on the left or
                        right half of the card.
                    */

                    const middle =
                        rect.left +
                        rect.width / 2;


                    clearPosterDropIndicator();


                    if (
                        event.clientX < middle
                    ) {

                        person.classList.add(
                            "poster-drop-before"
                        );

                    } else {

                        person.classList.add(
                            "poster-drop-after"
                        );

                    }

                }
            );


            // =================================
            // DROP
            // =================================

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


                    // =================================
                    // DROP AFTER
                    // =================================

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
// MOVE PARTICIPANT FROM PREVIEW
// =================================

function moveParticipantFromPreview(
    fromVisibleIndex,
    toVisibleIndex
) {

    const participants =
        posterState.participants;


    // =================================
    // GET VISIBLE PARTICIPANTS
    // =================================

    const visibleParticipants =
        participants.filter(
            participant =>
                participant.visible
        );


    // =================================
    // VALIDATE SOURCE
    // =================================

    if (
        fromVisibleIndex < 0 ||
        fromVisibleIndex >=
            visibleParticipants.length
    ) {

        return;

    }


    // =================================
    // GET PARTICIPANT
    // =================================

    const movedParticipant =
        visibleParticipants[
            fromVisibleIndex
        ];


    if (!movedParticipant) {
        return;
    }


    // =================================
    // FIND REAL ARRAY INDEX
    // =================================

    const fromRealIndex =
        participants.indexOf(
            movedParticipant
        );


    if (
        fromRealIndex === -1
    ) {

        return;

    }


    // =================================
    // REMOVE
    // =================================

    participants.splice(
        fromRealIndex,
        1
    );


    // =================================
    // GET REMAINING VISIBLE
    // =================================

    const remainingVisible =
        participants.filter(
            participant =>
                participant.visible
        );


    // =================================
    // CLAMP TARGET
    // =================================

    toVisibleIndex =
        Math.max(
            0,
            Math.min(
                toVisibleIndex,
                remainingVisible.length
            )
        );


    // =================================
    // INSERT
    // =================================

    const targetParticipant =
        remainingVisible[
            toVisibleIndex
        ];


    if (
        targetParticipant
    ) {

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

        /*
            No target participant means
            put the moved person after the
            last visible participant.

            Hidden participants remain
            where possible.
        */

        let lastVisibleRealIndex =
            -1;


        participants.forEach(
            (
                participant,
                index
            ) => {

                if (
                    participant.visible
                ) {

                    lastVisibleRealIndex =
                        index;

                }

            }
        );


        participants.splice(
            lastVisibleRealIndex + 1,
            0,
            movedParticipant
        );

    }


    // =================================
    // UPDATE CMS
    // =================================

    renderParticipants();


    // =================================
    // UPDATE POSTER
    // =================================

    renderPoster();

}


// =================================
// CLEAR PREVIEW DROP INDICATOR
// =================================

function clearPosterDropIndicator() {

    document
        .querySelectorAll(
            ".poster-person.poster-drop-before, .poster-person.poster-drop-after"
        )
        .forEach(
            person => {

                person.classList.remove(
                    "poster-drop-before",
                    "poster-drop-after"
                );

            }
        );

}