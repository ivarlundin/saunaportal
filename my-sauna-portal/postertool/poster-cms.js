// =================================
// POSTER CMS
// =================================

function renderParticipants() {

    const container =
        document.getElementById(
            "participants-list"
        );

    const count =
        document.getElementById(
            "participant-count"
        );


    if (!container) {
        return;
    }


    container.innerHTML = "";


    const visibleCount =
        posterState.participants
            .filter(
                participant =>
                    participant.visible
            )
            .length;


    if (count) {

        count.textContent =
            `${visibleCount}/${posterState.participants.length}`;

    }


    posterState.participants.forEach(
        (
            participant,
            index
        ) => {

            const row =
                document.createElement(
                    "div"
                );


            row.className =
                "participant-row";


            row.draggable = true;

            row.dataset.index =
                index;


            if (!participant.visible) {

                row.classList.add(
                    "hidden"
                );

            }


            // =================================
            // DRAG HANDLE
            // =================================

            const dragHandle =
                document.createElement(
                    "div"
                );

            dragHandle.className =
                "drag-handle";

            dragHandle.textContent =
                "☰";


            // =================================
            // IMAGE
            // =================================

            const image =
                document.createElement(
                    "img"
                );

            image.className =
                "participant-thumb";

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
                "participant-name";

            name.textContent =
                participant.name;


            // =================================
            // VISIBILITY
            // =================================

            const visibilityButton =
                document.createElement(
                    "button"
                );

            visibilityButton.className =
                "visibility-button";

            visibilityButton.type =
                "button";

            visibilityButton.textContent =
                participant.visible
                    ? "👁"
                    : "🚫";


            visibilityButton.addEventListener(
                "click",
                event => {

                    event.stopPropagation();


                    participant.visible =
                        !participant.visible;


                    renderParticipants();

                    renderPoster();

                }
            );


            // =================================
            // BUILD ROW
            // =================================

            row.appendChild(
                dragHandle
            );

            row.appendChild(
                image
            );

            row.appendChild(
                name
            );

            row.appendChild(
                visibilityButton
            );


            container.appendChild(
                row
            );

        }
    );


    setupDragAndDrop();
}

// =================================
// CMS DRAG & DROP
// =================================

function setupDragAndDrop() {

    const container =
        document.getElementById(
            "participants-list"
        );


    const rows =
        container?.querySelectorAll(
            ".participant-row"
        );


    if (!container || !rows) {
        return;
    }


    let draggedIndex = null;


    rows.forEach(
        row => {

            // =================================
            // DRAG START
            // =================================

            row.addEventListener(
                "dragstart",
                () => {

                    draggedIndex =
                        Number(
                            row.dataset.index
                        );


                    row.classList.add(
                        "dragging"
                    );

                }
            );


            // =================================
            // DRAG END
            // =================================

            row.addEventListener(
                "dragend",
                () => {

                    row.classList.remove(
                        "dragging"
                    );


                    clearDropIndicator();


                    draggedIndex = null;

                }
            );


            // =================================
            // DRAG OVER
            // =================================

            row.addEventListener(
                "dragover",
                event => {

                    event.preventDefault();


                    if (
                        draggedIndex === null
                    ) {

                        return;

                    }


                    const targetIndex =
                        Number(
                            row.dataset.index
                        );


                    if (
                        draggedIndex === targetIndex
                    ) {

                        clearDropIndicator();

                        return;

                    }


                    const rect =
                        row.getBoundingClientRect();


                    const mouseY =
                        event.clientY;


                    const middle =
                        rect.top +
                        rect.height / 2;


                    clearDropIndicator();


                    if (
                        mouseY < middle
                    ) {

                        row.classList.add(
                            "drop-before"
                        );

                    } else {

                        row.classList.add(
                            "drop-after"
                        );

                    }

                }
            );


            // =================================
            // DROP
            // =================================

            row.addEventListener(
                "drop",
                event => {

                    event.preventDefault();


                    if (
                        draggedIndex === null
                    ) {

                        return;

                    }


                    const targetIndex =
                        Number(
                            row.dataset.index
                        );


                    if (
                        draggedIndex === targetIndex
                    ) {

                        clearDropIndicator();

                        return;

                    }


                    const rect =
                        row.getBoundingClientRect();


                    const mouseY =
                        event.clientY;


                    const middle =
                        rect.top +
                        rect.height / 2;


                    let insertIndex =
                        targetIndex;


                    // =================================
                    // DROP AFTER
                    // =================================

                    if (
                        mouseY >= middle
                    ) {

                        insertIndex =
                            targetIndex + 1;

                    }


                    moveParticipant(
                        draggedIndex,
                        insertIndex
                    );


                    clearDropIndicator();

                }
            );

        }
    );


    // =================================
    // CONTAINER DRAG OVER
    // =================================

    container.addEventListener(
        "dragover",
        event => {

            event.preventDefault();

        }
    );
}


// =================================
// CLEAR DROP INDICATOR
// =================================

function clearDropIndicator() {

    document
        .querySelectorAll(
            ".participant-row.drop-before, .participant-row.drop-after"
        )
        .forEach(
            row => {

                row.classList.remove(
                    "drop-before",
                    "drop-after"
                );

            }
        );
}
// =================================
// MOVE PARTICIPANT
// =================================

function moveParticipant(
    fromIndex,
    toIndex
) {

    const participants =
        posterState.participants;


    if (
        fromIndex < 0 ||
        fromIndex >= participants.length
    ) {

        return;

    }


    const movedParticipant =
        participants.splice(
            fromIndex,
            1
        )[0];


    // =================================
    // ACCOUNT FOR REMOVED ITEM
    // =================================

    if (
        toIndex > fromIndex
    ) {

        toIndex--;

    }


    // =================================
    // CLAMP INDEX
    // =================================

    toIndex =
        Math.max(
            0,
            Math.min(
                toIndex,
                participants.length
            )
        );


    participants.splice(
        toIndex,
        0,
        movedParticipant
    );


    renderParticipants();

    renderPoster();

    setupPosterPreviewDrag();

}

// =================================
// CMS TABS
// =================================

function setupCmsTabs() {

    const tabs =
        document.querySelectorAll(
            ".cms-tab"
        );

    const panels =
        document.querySelectorAll(
            ".cms-tab-panel"
        );


    tabs.forEach(
        tab => {

            tab.addEventListener(
                "click",
                () => {

                    const target =
                        tab.dataset.tab;


                    // =================================
                    // TAB STATE
                    // =================================

                    tabs.forEach(
                        item => {

                            item.classList.toggle(
                                "active",
                                item === tab
                            );

                        }
                    );


                    // =================================
                    // PANEL STATE
                    // =================================

                    panels.forEach(
                        panel => {

                            panel.classList.toggle(
                                "active",
                                panel.dataset.tab === target
                            );

                        }
                    );


                    // =================================
                    // REFRESH PREVIEW
                    // =================================

                    renderPoster();

                }
            );

        }
    );
}


// =================================
// POSTER STYLE CONTROLS
// =================================

function setupPosterStyleControls() {

    const columnsInput =
        document.getElementById(
            "poster-columns"
        );

    const gapInput =
        document.getElementById(
            "poster-gap"
        );

    const columnsValue =
        document.getElementById(
            "poster-columns-value"
        );

    const gapValue =
        document.getElementById(
            "poster-gap-value"
        );


    // =================================
    // ENSURE STYLE STATE
    // =================================

    if (!posterState.style) {

        posterState.style = {};

    }


    // =================================
    // DEFAULTS
    // =================================

    if (
        posterState.style.columns === undefined
    ) {

        posterState.style.columns = 4;

    }


    if (
        posterState.style.gap === undefined
    ) {

        posterState.style.gap = 5;

    }


    // =================================
    // INITIAL INPUT VALUES
    // =================================

    if (columnsInput) {

        columnsInput.value =
            posterState.style.columns;

    }


    if (gapInput) {

        gapInput.value =
            posterState.style.gap;

    }


    // =================================
    // INITIAL VALUE DISPLAY
    // =================================

    if (columnsValue) {

        columnsValue.textContent =
            posterState.style.columns;

    }


    if (gapValue) {

        gapValue.textContent =
            posterState.style.gap;

    }


    // =================================
    // COLUMNS
    // =================================

    columnsInput?.addEventListener(
        "input",
        () => {

            const value =
                Number(
                    columnsInput.value
                );


            if (
                Number.isFinite(value) &&
                value >= 1
            ) {

                posterState.style.columns =
                    value;

            }


            if (columnsValue) {

                columnsValue.textContent =
                    posterState.style.columns;

            }


            renderPoster();

        }
    );


    // =================================
    // GAP
    // =================================

    gapInput?.addEventListener(
        "input",
        () => {

            const value =
                Number(
                    gapInput.value
                );


            if (
                Number.isFinite(value) &&
                value >= 0
            ) {

                posterState.style.gap =
                    value;

            }


            if (gapValue) {

                gapValue.textContent =
                    posterState.style.gap;

            }


            renderPoster();

        }
    );

}


// =================================
// INIT CMS
// =================================

function setupPosterCms() {

    setupCmsTabs();

    setupPosterStyleControls();

    renderParticipants();

    renderPoster();

    setupPosterPreviewDrag();

}


// =================================
// DOM READY
// =================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupPosterCms();

    }
);