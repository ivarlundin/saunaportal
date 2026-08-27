# Event Poster Tool — Project Context

## 1. Projektöversikt

Detta är en superenkel statisk webbapp för ett event.

Syftet är:

### Mobil

1. Ta foto på en deltagare
2. Alternativt ladda upp en befintlig bild
3. Croppa/positionera bilden
4. Skriva deltagarens namn
5. Ladda upp bild + namn till Supabase

### Desktop

1. Hämta alla deltagare från Supabase
2. Visa bilder och namn
3. Ändra ordningen genom drag & drop
4. Ändra ordningen direkt i poster-preview
5. Dölja deltagare
6. Visa deltagare igen
7. Ändra titel och undertext
8. Visa live-preview av en A4-poster
9. Senare kunna skriva ut / skapa PDF

Projektet ska vara så enkelt som möjligt.

Ingen backend-server.

Ingen Node-server.

Ingen React.

Ingen build pipeline.

Det ska vara:

HTML + CSS + vanilla JavaScript + Supabase.

Projektet ska kunna hostas statiskt, exempelvis GitHub Pages.


# 2. Teknisk arkitektur

Frontend:

- index.html
- styles.css
- app.js
- photo-form.js
- photo-comp.js
- poster-preview.js
- poster-cms.js
- poster-state.js

Externa dependencies:

- Supabase JS client via CDN

Supabase används för:

- PostgreSQL database
- Storage bucket för bilder

Frontend kommunicerar direkt med Supabase från browsern.

Ingen egen API-server.


# 3. Authentication

Authentication är för närvarande borttagen.

Projektet ska INTE ha:

- login
- lösenordsruta
- auth-view
- check-event-password Edge Function
- lokal auth-session
- logout-knapp
- AUTH_STORAGE_KEY
- AUTH_DURATION
- Authorization-header för egen auth-funktion

Appen ska starta direkt.

Flödet är:

Browser
↓
Supabase publishable key
↓
Supabase Database / Storage

Det innebär att säkerheten istället hanteras av Supabase RLS och Storage policies.

Publishable key får ligga i frontend.

Service role key får ALDRIG ligga i frontend.

Det finns för närvarande inget behov av authentication eftersom projektet är ett litet eventverktyg.


# 4. Git

Repository har:

- main
- dev

Tanken är:

## main

- Stabil version
- Det som ligger live

## dev

- All utveckling
- Nya features
- Experiment

Ändringar ska normalt göras på dev.

När allt fungerar:

dev -> main via merge / pull request.


# 5. Supabase

Supabase project URL:

https://nicpgzkkyktzphkyzhfl.supabase.co

REST API base:

https://nicpgzkkyktzphkyzhfl.supabase.co/rest/v1/

Frontend använder Supabase publishable key.

Publishable key är avsedd att ligga i browserkod.

Det är viktigt att RLS + policies används korrekt.

Service role key ska ALDRIG läggas i frontend.

Nuvarande frontend-konfiguration:

const SUPABASE_URL =
    "https://nicpgzkkyktzphkyzhfl.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_-u_XwxwKUozPU086NvvKrg_37sY3yXn";

const supabaseClient =
    supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );


# 6. Supabase Storage

Bucket:

poster_photos

Bucket är:

PUBLIC

Nuvarande storage:

poster_photos

Max filstorlek som visas i dashboard:

50 MB

Vanliga iPhone-bilder kommer inte i närheten av detta.

Projektet förväntas bara ha ungefär 50 bilder per event.

Bilderna laddas upp till:

poster_photos/<filename>


# 7. Supabase Database

Tabell:

participants

Förväntade fält:

- id
- name
- photo_path
- created_at

Exempel:

id:

UUID / primary key

name:

text

photo_path:

text

created_at:

timestamp


# 8. RLS / policies

RLS ska vara aktiverat.

Eftersom appen är statisk och mobilformuläret ska kunna användas publikt behöver vi policies som tillåter det vi faktiskt vill göra.

Nuvarande funktioner kräver:

participants:

- INSERT
- SELECT

Storage:

- INSERT/upload
- SELECT/read

Bucketen är public så bilderna kan läsas via public URL.

Vi använder publishable/anon-klienten i frontend.

Authentication ska inte användas för att kringgå RLS.

RLS är den faktiska säkerhetsgränsen.


# 9. index.html

index.html innehåller tre huvudsakliga views:

1. mobile-view
2. desktop-view
3. dev-view

Det finns INTE längre någon auth-view.

Supabase JS laddas från CDN.

Scripts laddas med defer.

Nuvarande scriptordning:

<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

<script src="photo-comp.js" defer></script>
<script src="photo-form.js" defer></script>
<script src="poster-preview.js" defer></script>
<script src="poster-cms.js" defer></script>
<script src="poster-state.js" defer></script>
<script src="app.js" defer></script>

Supabase CDN-scriptet behöver vara tillgängligt innan våra scripts kör Supabase-initiering.

Defer innebär att scripts laddas parallellt men exekveras efter HTML-parsningen i dokumentordning.


# 10. App startup

Appen ska inte vänta på någon authentication.

Startup:

DOMContentLoaded
↓
app init
↓
detectView()
↓
setup controls
↓
load participants
↓
render CMS
↓
render poster

Desktop eller mobile väljs baserat på viewport.

Det finns ingen login-gate.


# 11. Mobile UX

Mobilen är uppbyggd som ett steg-för-steg-flöde.

## Steg 1

TA BILD

eller

LADDA UPP BILD

## Steg 2

PLACERA BILD

Här visas croppern.

Användaren kan:

- zooma
- flytta bilden horisontellt
- flytta bilden vertikalt

En overlay visas ovanpå bilden.

Overlay:

portrait-overlay.png

Overlay aspect ratio:

405 / 564

Crop-rutan ska ha samma aspect ratio:

405 / 564

## Steg 3

ÄR BILDEN KLAR?

Här visas den färdiga beskurna bilden.

Användaren skriver:

Namn

och klickar:

Spara deltagare


# 12. Mobile navigation

Mobilen ska inte vara en lång scrollande form.

Det ska vara:

Steg 1

↓

Steg 2

↓

Steg 3

I crop-steget finns:

← Tillbaka

uppe till vänster

och:

Nästa →

uppe till höger

På så sätt kan användaren navigera enkelt även när croppern visas.


# 13. Photo input

Två inputs används.

Kamera:

<input
    id="photo"
    type="file"
    accept="image/*"
    capture="environment"
    hidden
>

Upload:

<input
    id="photo-upload"
    type="file"
    accept="image/*"
    hidden
>

Kamera-knappen:

<label for="photo" class="take-photo-button">
    Ta bild
</label>

Upload-knappen:

<label for="photo-upload" class="upload-photo-button">
    Ladda upp bild
</label>

Båda inputs går genom samma JavaScript-funktion:

handlePhotoSelected(file)

och går sedan direkt till crop-steget.


# 14. Photo cropping

Crop-logiken ligger i:

photo-comp.js

photo-form.js ansvarar för flow/navigation/upload.

photo-comp.js ansvarar för själva crop-funktionen.

photo-comp ska exponera funktioner som används av photo-form:

loadCropImage(file)

createCroppedImage()

Croppern ska:

- visa originalbilden
- skala bilden
- flytta X
- flytta Y
- zooma
- visa portrait-overlay.png ovanpå
- generera en beskuren JPEG Blob

Crop output ska vara:

JPEG

med aspect ratio:

405 / 564


# 15. Temporary crop

Efter crop sparas resultatet temporärt:

window.croppedPhotoBlob

Denna Blob laddas först upp när användaren trycker:

Spara deltagare


# 16. Upload

När användaren sparar:

1. Kontrollera att croppedPhotoBlob finns
2. Kontrollera att namn finns
3. Skapa unikt filnamn
4. Upload till Supabase Storage
5. Insert i participants
6. Reset form
7. Gå tillbaka till steg 1

Nuvarande filnamn skapas ungefär:

`${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`

Upload:

supabaseClient
    .storage
    .from("poster_photos")
    .upload(
        fileName,
        window.croppedPhotoBlob,
        {
            contentType: "image/jpeg",
            upsert: false
        }
    )

Database insert:

supabaseClient
    .from("participants")
    .insert({
        name: name,
        photo_path: fileName
    })


# 17. Desktop CMS

Desktop view består av två huvuddelar.

Vänster:

CMS panel

Höger:

Poster preview

Layout:

desktop-layout

grid:

380px + resten


# 18. CMS

CMS-panelen ska innehålla:

- Logo
- Titel-input
- Undertext-input
- Deltagarlista
- Poster style controls

Titel:

id="poster-title"

Placeholder:

Poster Bastusällskap 2025

Undertext:

id="poster-subtitle"

Placeholder:

– Vem är vem? –

När inputs ändras ska poster-preview uppdateras direkt.


# 19. Participants CMS

Alla deltagare hämtas från:

participants

Sortering:

created_at ascending

Deltagarlistan ska logiskt representera:

- drag handle
- namn
- visibility button

Thumbnail kan fortfarande skapas av JS men ska INTE visas i CMS-listan.

CSS:

.participant-thumb {
    display: none !important;
}

CMS-listan ska vara:

- kompakt
- låg
- enkel
- 90s workstation/hardware-känsla

Exempel:

☰   Ivar                                      👁

Deltagare ska kunna:

- flyttas
- döljas
- visas igen


# 20. CMS ordering

Ordering hanteras i:

posterState.participants

CMS-listan använder HTML5 drag & drop.

Varje participant row får:

row.dataset.index = index

Drag start:

draggedIndex = index

Drag over:

musens Y-position jämförs med radens vertikala mittpunkt.

Om musen är ovanför mitten:

.drop-before

Om musen är under mitten:

.drop-after

En visuell lucka/indikator visas mellan raderna.

Exempel:

Person A

────────────

Person B

eller:

Person A

Person B

────────────

När användaren släpper:

moveParticipant(
    draggedIndex,
    insertIndex
)

Efter flytt:

renderParticipants()

renderPoster()

setupPosterPreviewDrag()


# 21. CMS drop indicator

CMS-listan ska visa en faktisk visuell lucka när användaren drar.

CSS använder:

.participant-row.drop-before

.participant-row.drop-after

Exempel:

.participant-row.drop-before {
    margin-top: 7px;
}

.participant-row.drop-before::before {
    content: "";
    position: absolute;
    top: -7px;
    left: 0;
    right: 0;
    height: 3px;
    background: #000080;
    pointer-events: none;
}

Samma princip används för drop-after.


# 22. Poster state

Nuvarande state:

const posterState = {

    title: "",

    subtitle: "",

    participants: [],

    style: {

        columns: 4,

        gap: 5

    }

};

Participants laddas från Supabase och kompletteras lokalt med:

visible: true

Exempel:

{
    id: "...",
    name: "Ivar",
    photo_path: "123abc.jpg",
    created_at: "...",
    visible: true
}


# 23. Poster preview

Poster preview ska representera exakt A4.

CSS:

width: 210mm;

height: 297mm;

aspect-ratio:
210 / 297

Poster:

<div id="poster-preview" class="poster">

Poster header:

<header class="poster-header">

    <h1 id="preview-title">
        Poster Bastusällskap 2025
    </h1>

    <p id="preview-subtitle">
        – Vem är vem? –
    </p>

</header>

Poster grid:

<div
    id="poster-grid"
    class="poster-grid"
>
</div>


# 24. Poster grid

Poster grid visar alla deltagare som är visible.

Varje person:

- bild
- namn

Gridens columns styrs av:

posterState.style.columns

Gridens gap styrs av:

posterState.style.gap

CSS custom properties:

--poster-columns
--poster-gap

Default:

4 columns

5mm gap

Bilderna har:

aspect-ratio: 4 / 5

object-fit:
cover


# 25. Poster preview rendering

renderPoster() ansvarar för att:

1. Hämta poster-grid
2. Hämta title/subtitle
3. Läsa inputs
4. Uppdatera title/subtitle
5. Läsa poster style state
6. Uppdatera CSS custom properties
7. Rendera alla visible participants
8. Skapa bilder
9. Skapa namn
10. Skapa hover visibility button
11. Sätta visibleIndex
12. Initiera preview drag & drop

VIKTIGT:

renderPoster() rensar:

grid.innerHTML = "";

och bygger sedan hela poster-grid på nytt.

Därför måste drag listeners kopplas om efter rendering.


# 26. Poster participant DOM

Varje person i preview skapas ungefär så här:

<div class="poster-person">

    <img
        class="poster-person-image"
    >

    <div class="poster-person-name">
        Ivar
    </div>

    <button
        class="poster-person-visibility"
    >
        👁
    </button>

</div>

Varje person får:

person.dataset.visibleIndex

Detta index är indexet i den VISIBLE listan.

Det är viktigt.

Det ska INTE vara indexet i:

posterState.participants

eftersom hidden participants inte renderas i preview.


# 27. Poster preview visibility

På varje poster-person finns en visibility-knapp.

Knappen:

class:

poster-person-visibility

Default:

👁

Knappen ska vara osynlig tills användaren hovrar över personen.

När knappen klickas:

participant.visible = false

Sedan:

renderParticipants()

renderPoster()

Klicket ska inte starta drag.

Använd:

event.preventDefault()

event.stopPropagation()


# 28. Poster preview hover controls

Poster preview ska vara visuellt ren.

När användaren inte hovrar över en person ska:

- visibility button vara dold
- drag affordance vara diskret/inte synlig

När användaren hovrar över personen ska:

- visibility button visas
- drag affordance visas

Detta ska lösas primärt med CSS.

Exempel:

.poster-person-visibility {
    opacity: 0;
    pointer-events: none;
}

.poster-person:hover .poster-person-visibility {
    opacity: 1;
    pointer-events: auto;
}

Poster-person ska även kunna få en subtil hover state.


# 29. Poster preview drag & drop

Användaren ska kunna ändra ordningen direkt genom att dra bilderna/personerna i poster-preview.

Drag & drop sker endast på:

.poster-person

Varje person får:

person.draggable = true

och:

person.dataset.visibleIndex = visibleIndex


# 30. Poster preview drag index

Preview använder VISIBLE index.

Exempel:

posterState.participants:

0 Ivar visible

1 Anna hidden

2 Kalle visible

3 Lisa visible

Preview:

0 Ivar

1 Kalle

2 Lisa

Ivar:

data-visible-index="0"

Kalle:

data-visible-index="1"

Lisa:

data-visible-index="2"


# 31. Poster preview drag start

När drag startar:

draggedVisibleIndex =
    Number(
        person.dataset.visibleIndex
    );

Personen får:

.poster-dragging

DataTransfer:

effectAllowed = "move"


# 32. Poster preview drag over

När användaren drar över en annan poster-person:

event.preventDefault()

Target index hämtas från:

person.dataset.visibleIndex

Om source === target:

ingen indikator

Annars beräknas kortets horisontella mittpunkt:

const rect =
    person.getBoundingClientRect();

const middle =
    rect.left +
    rect.width / 2;

Om musen är till vänster om mitten:

.poster-drop-before

Om musen är till höger:

.poster-drop-after


# 33. Poster preview drop indicator

Poster preview ska visa en tydlig lucka/indikator där personen kommer att hamna.

CSS:

.poster-person.poster-drop-before::before

.poster-person.poster-drop-after::after

Indikatorn ska vara vertikal eftersom gridens ordering är horisontell.

Exempel:

[ A ] | [ B ] [ C ]

eller:

[ A ] [ B ] | [ C ]

Indikatorn ska inte påverka layoutens faktiska storlek.


# 34. Poster preview drop

Vid drop:

Om musen är vänster om target:

insertVisibleIndex = targetVisibleIndex

Om musen är höger:

insertVisibleIndex = targetVisibleIndex + 1

Sedan:

moveParticipantFromPreview(
    draggedVisibleIndex,
    insertVisibleIndex
)


# 35. moveParticipantFromPreview

Funktionen:

moveParticipantFromPreview(
    fromVisibleIndex,
    toVisibleIndex
)

måste hantera skillnaden mellan:

VISIBLE INDEX

och:

REAL ARRAY INDEX

Först skapas:

const visibleParticipants =
    participants.filter(
        participant =>
            participant.visible
    );

Source hämtas:

const movedParticipant =
    visibleParticipants[
        fromVisibleIndex
    ];

Sedan hittas participantens riktiga index:

const fromRealIndex =
    participants.indexOf(
        movedParticipant
    );

Deltagaren tas bort från den riktiga arrayen.

Efter detta skapas en ny visible-lista.

Target clampas:

toVisibleIndex =
    Math.max(
        0,
        Math.min(
            toVisibleIndex,
            remainingVisible.length
        )
    );

Sedan sätts deltagaren tillbaka framför targetParticipant.

Om target saknas läggs deltagaren efter sista visible participant.

Hidden participants ska behålla sin relativa position så långt det är möjligt.


# 36. Viktig ordering-regel

Poster preview och CMS-listan måste använda samma:

posterState.participants

Det finns alltså INTE två separata order states.

Preview ändrar:

posterState.participants

CMS-listan renderas sedan från samma state.

CMS ändrar:

posterState.participants

Preview renderas sedan från samma state.

Detta gör att:

DRAG PREVIEW

↓

posterState.participants

↓

renderParticipants()

↓

CMS uppdateras

och:

DRAG CMS

↓

posterState.participants

↓

renderPoster()

↓

Preview uppdateras


# 37. Synkning mellan preview och CMS

När användaren ändrar ordningen i preview ska CMS-listan uppdateras omedelbart.

Flöde:

moveParticipantFromPreview()

↓

posterState.participants ändras

↓

renderParticipants()

↓

renderPoster()

Preview och CMS visar därmed alltid samma ordering.

När användaren ändrar ordningen i CMS:

moveParticipant()

↓

posterState.participants ändras

↓

renderParticipants()

↓

renderPoster()

Samma ordering visas överallt.


# 38. Hidden participants och ordering

Hidden participants finns fortfarande i:

posterState.participants

men renderas inte i:

poster-grid

De syns däremot i:

participants-list

Exempel:

posterState.participants:

Ivar visible

Anna hidden

Kalle visible

Lisa visible

CMS:

Ivar

Anna

Kalle

Lisa

Preview:

Ivar

Kalle

Lisa

Preview drag använder endast visible participants.

CMS drag använder hela participants-arrayen.


# 39. Poster preview drag state

Preview drag använder:

let draggedVisibleIndex = null;

CMS drag använder:

let draggedIndex = null;

Dessa ska inte blandas ihop.

Preview:

draggedVisibleIndex

CMS:

draggedIndex


# 40. Drop indicator cleanup

Poster preview använder:

clearPosterDropIndicator()

Den tar bort:

.poster-drop-before

.poster-drop-after

från alla poster-person elements.

CMS använder:

clearDropIndicator()

Den tar bort:

.drop-before

.drop-after

från alla participant-row elements.


# 41. Preview mode

Poster preview ska kunna visas i två lägen:

FIT

och

FILL

FIT:

Hela A4-postern skalas så att hela postern syns.

FILL:

Postern fyller tillgänglig preview-yta och kan beskäras visuellt av preview-containern.

Preview mode controls använder:

#preview-fit

#preview-fill

Poster-elementet får:

.preview-fit

eller:

.preview-fill


# 42. Preview controls

setupPreviewControls() ansvarar för:

- FIT
- FILL
- active state
- default mode

FIT:

poster.classList.add("preview-fit")

FILL:

poster.classList.add("preview-fill")

Endast en mode-class ska vara aktiv åt gången.


# 43. Title inputs

setupPosterInputs() ansvarar för:

#poster-title

#poster-subtitle

När input ändras:

renderPoster()

Poster-preview uppdateras direkt.


# 44. Poster style controls

setupPosterStyleControls() ansvarar för:

#poster-columns

#poster-gap

#poster-columns-value

#poster-gap-value

Defaults:

columns = 4

gap = 5

Poster grid får:

--poster-columns

--poster-gap

Exempel:

grid.style.setProperty(
    "--poster-columns",
    columns
);

grid.style.setProperty(
    "--poster-gap",
    `${gap}mm`
);


# 45. CMS tabs

setupCmsTabs() ansvarar för:

.cms-tab

.cms-tab-panel

När tab klickas:

1. Aktiv tab ändras
2. Aktiv panel ändras
3. renderPoster() körs


# 46. CMS CSS

CMS ska ha 90s professional hardware-look.

Design language:

- grå plast
- hårda borders
- bevel
- emboss
- blå accent
- mörka shadows
- små textstorlekar
- kompakt layout
- inga moderna rundade kort
- inga glass effects
- inga moderna SaaS gradients

CMS panel:

.cms-panel

CMS header:

.cms-header

CMS tabs:

.cms-tabs

.cms-tab

Participants:

.participant-row


# 47. CMS participant list

CMS-listan ska vara kompakt.

Bilder ska inte synas.

JS får fortfarande skapa:

.participant-thumb

men CSS ska dölja den:

.participant-thumb {
    display: none !important;
}

Participant row ska i praktiken bestå av:

drag handle

namn

visibility button


# 48. CMS participant hover

CMS ska vara visuellt kompakt.

Visibility button kan vara synlig eftersom den är en funktionell kontroll.

Drag handle ska vara synlig eller mycket subtil.

Det ska inte finnas stora bilder eller onödiga UI-element.


# 49. Current CMS row structure

Varje row skapas ungefär:

<div class="participant-row">

    <div class="drag-handle">
        ☰
    </div>

    <img
        class="participant-thumb"
    >

    <div class="participant-name">
        Ivar
    </div>

    <button
        class="visibility-button"
    >
        👁
    </button>

</div>

CSS döljer thumbnail.


# 50. CMS visibility

Visibility state är lokal.

När visibility button klickas:

participant.visible =
    !participant.visible;

Sedan:

renderParticipants();

renderPoster();

Detta uppdaterar både CMS och preview.


# 51. Poster visibility

Poster preview har även en hover-baserad visibility button.

När den klickas:

participant.visible = false;

Sedan:

renderParticipants();

renderPoster();


# 52. Initiering

setupPosterCms() ansvarar för desktop CMS initialization.

Nuvarande:

function setupPosterCms() {

    setupCmsTabs();

    setupPosterStyleControls();

    renderParticipants();

    renderPoster();

}

OBS:

renderPoster() kör redan:

setupPosterPreviewDrag()

efter att poster-person elements har skapats.

Det innebär att ett separat:

setupPosterPreviewDrag()

efter renderPoster()

är redundant.

Preferred implementation:

function setupPosterCms() {

    setupCmsTabs();

    setupPosterStyleControls();

    setupPosterInputs();

    renderParticipants();

    renderPoster();

}

renderPoster() hanterar preview drag initialization efter att DOM-elementen skapats.


# 53. DOM ready

CMS initieras efter:

DOMContentLoaded

Exempel:

document.addEventListener(
    "DOMContentLoaded",
    () => {
        setupPosterCms();
    }
);


# 54. Important function ownership

## app.js

Ansvar:

- Supabase initialization
- global app state
- view detection
- mobile/desktop switching
- dev mode
- loading participants
- poster state
- initialization

## photo-form.js

Ansvar:

- mobile form
- mobile steps
- name
- upload
- submit
- status
- reset

## photo-comp.js

Ansvar:

- crop image
- zoom
- X
- Y
- crop generation
- overlay
- crop calculations

## poster-preview.js

Ansvar:

- renderPoster()
- setupPosterPreviewDrag()
- moveParticipantFromPreview()
- clearPosterDropIndicator()
- setupPreviewControls()
- setupPosterInputs()

## poster-cms.js

Ansvar:

- renderParticipants()
- setupDragAndDrop()
- moveParticipant()
- clearDropIndicator()
- setupCmsTabs()
- setupPosterStyleControls()
- setupPosterCms()

## poster-state.js

Ansvar:

- posterState
- shared participant state
- state helpers om sådana behövs

## styles.css

Ansvar:

- all styling

## index.html

Ansvar:

- markup
- structure


# 55. Important poster functions

Viktiga funktioner:

renderPoster()

setupPreviewControls()

setupPosterInputs()

setupPosterPreviewDrag()

moveParticipantFromPreview()

clearPosterDropIndicator()

renderParticipants()

setupDragAndDrop()

moveParticipant()

clearDropIndicator()

setupCmsTabs()

setupPosterStyleControls()

setupPosterCms()


# 56. Current poster preview implementation

renderPoster() ska:

- hämta grid
- hämta title/subtitle
- läsa inputs
- uppdatera title/subtitle
- läsa style state
- uppdatera grid CSS variables
- tömma grid
- filtrera visible participants
- skapa poster-person
- sätta visibleIndex
- skapa image
- skapa name
- skapa visibility button
- append
- setupPosterPreviewDrag()


# 57. Current poster preview implementation — important detail

visibleIndex måste skapas från:

const visibleParticipants =
    posterState.participants.filter(
        participant =>
            participant.visible
    );

Sedan:

visibleParticipants.forEach(
    (
        participant,
        visibleIndex
    ) => {

        person.dataset.visibleIndex =
            visibleIndex;

    }
);

Detta är kritiskt för drag & drop.


# 58. Potential bug to avoid

Använd INTE participant.name för att identifiera poster-person.

Då namn kan vara:

- duplicerade
- ändrade
- tomma

Använd istället participant object / id där det är möjligt.

Current implementation använder visibleIndex för preview ordering.

Det är acceptabelt så länge renderingen alltid bygger index från samma visibleParticipants-array.


# 59. Potential improvement

I framtiden kan preview-person få:

person.dataset.id =
    participant.id;

Detta skulle göra identifiering ännu robustare.

Men ordering ska fortfarande hanteras via:

posterState.participants


# 60. Poster preview hover UX

Målet är:

Normal state:

[ IMAGE ]

Ivar

Hover:

[ IMAGE ]        👁

Ivar

   ↔ drag affordance

Det ska inte vara en stor overlay.

Kontrollerna ska vara små och hårda.

90s hardware style.

Ingen modern floating action button.


# 61. Poster preview drag UX

När användaren börjar dra:

- source blir semi-transparent
- drop indicator visas
- target flyttas visuellt genom en lucka/indikator
- användaren ska tydligt förstå exakt var personen kommer hamna

När drag avslutas:

- source återställs
- indikatorer rensas
- state uppdateras
- CMS uppdateras


# 62. Poster preview CSS

Grundstruktur:

.poster-person {

    position: relative;

    cursor: grab;

}

.poster-person:active {

    cursor: grabbing;

}

.poster-person.poster-dragging {

    opacity: 0.35;

}

.poster-person.poster-drop-before::before {

    content: "";

    position: absolute;

    top: 0;

    bottom: 0;

    left: -6px;

    width: 4px;

    background: #000080;

    pointer-events: none;

}

.poster-person.poster-drop-after::after {

    content: "";

    position: absolute;

    top: 0;

    bottom: 0;

    right: -6px;

    width: 4px;

    background: #000080;

    pointer-events: none;

}


# 63. Poster preview visibility CSS

Visibility button ska vara dold default.

Exempel:

.poster-person-visibility {

    opacity: 0;

    pointer-events: none;

}

Vid hover:

.poster-person:hover .poster-person-visibility {

    opacity: 1;

    pointer-events: auto;

}

Transition får vara mycket kort eller ingen alls.

Designen ska kännas som hardware UI, inte modern web UI.


# 64. Poster preview image

Poster image:

.poster-person-image

ska:

- fylla personens image area
- använda object-fit: cover
- ha aspect-ratio 4 / 5

Bilden ska inte ändra storlek vid hover på ett sätt som påverkar grid-layouten.

Hover controls ska ligga ovanpå.


# 65. Poster grid ordering

CSS grid ordning styrs av DOM-order.

Därför räcker det att:

posterState.participants

renderas i korrekt ordning.

Ingen separat CSS order ska användas.


# 66. Persistent ordering

Ordering är för närvarande endast lokal.

Det betyder:

page reload

↓

Supabase fetch

↓

created_at ascending

↓

lokal ordering återställs

Det finns ännu ingen persistent ordering column.

Framtida lösning kan vara:

sort_order

eller:

position

i participants-tabellen.

Det ska inte implementeras förrän det behövs.


# 67. Persistent visibility

Visibility är också för närvarande lokal.

Reload:

visible = true

för alla participants.

Framtida möjlighet:

visible

som DB field.

Men detta behövs inte initialt.


# 68. PDF / Print

Ingen riktig PDF-generator behövs initialt.

Poster-preview är ren HTML/CSS.

Eftersom postern är exakt A4 kan browserns:

Print -> Save as PDF

användas.

Målet är:

- A4
- svartvitt print fungerar
- enkel HTML/CSS
- ingen server-side PDF rendering

Senare kan print CSS läggas till med:

@media print

för att:

- gömma CMS
- gömma UI
- endast skriva ut poster
- ställa A4
- ta bort marginaler

Senare kan även en Print-knapp läggas till.


# 69. Logo

En logo finns i samma directory:

my-sauna-portal.png

Den ska visas:

Mobile:

- i mobile header

Desktop:

- i CMS-panelen till vänster

Logotypen ska inte dominera.


# 70. Design language

Designen ska ha:

90's feeling

Men inte vara en generisk "retro neon" design.

Riktning:

1990s space-age hardware

1990s consumer electronics

NASA / workstation / high-end electronics

Design-element:

- bevels
- emboss
- hårda borders
- grå plast
- bright blue accent
- fysiska knappar
- mörka hårda skuggor
- subtila highlights

Undvik:

- modern SaaS-look
- glassmorphism
- gradients som ser moderna ut
- överdrivet neon
- vaporwave
- onödiga emojis
- generic rounded modern UI


# 71. Ta bild-knappen

Primärknappen heter:

Ta bild

Ingen emoji.

Den ska vara:

- bright blue
- stor
- hård
- 90s space-age
- bevel/emboss
- fysisk knappkänsla

Använd inte längre den gamla dekorativa ::after med små pixelliknande block.

Det såg ut som en bugg.


# 72. Ladda upp bild-knappen

Sekundärknappen heter:

Ladda upp bild

Den ska vara:

- mindre
- grå/silver
- samma 90s hardware-system
- mindre visuellt dominant än Ta bild


# 73. app.js

app.js ska helst hålla:

- Supabase initialization
- global app state
- view detection
- mobile/desktop switching
- dev mode
- loading participants
- initialization

Poster rendering och CMS-logik ligger helst i:

poster-preview.js

poster-cms.js

poster-state.js

Om app.js blir för stor ska logik flyttas till separata scripts.

Projektet ska fortfarande hållas så enkelt som möjligt.


# 74. Dev mode

Dev mode aktiveras genom:

Enter två gånger snabbt.

När dev mode är aktivt visas:

Dev mode

Dev mode visar:

- Viewport
- Current view

Och buttons:

- Mobile
- Desktop

Dev mode ska kunna användas för att testa mobile UI på desktop.


# 75. View detection

Automatiskt:

window.innerWidth <= 700

=> mobile

annars:

desktop

I dev mode sker ingen automatisk view switching.


# 76. Current HTML structure

Main:

<main id="app">

Mobile:

<section id="mobile-view" class="view">

Desktop:

<section id="desktop-view" class="view">

Dev:

<section id="dev-view" class="view">

Det finns INTE:

<section id="auth-view">

Authentication ska inte längre finnas i HTML.


# 77. Mobile HTML structure

Mobile flow:

mobile-app

mobile-header

mobile-step-indicator

photo-step

crop-step

details-step

photo-step:

- title
- instructions
- Ta bild
- Ladda upp bild

crop-step:

- back
- next
- crop stage
- crop image
- portrait overlay
- zoom slider
- x slider
- y slider

details-step:

- back
- final photo preview
- name input
- save button
- status


# 78. Desktop HTML structure

desktop-layout

cms-panel

preview-panel

cms-panel:

- cms-header
- poster-settings
- participants-header
- participants-list
- CMS tabs
- style controls
- preview controls

preview-panel:

- poster
- poster-header
- poster-grid


# 79. Current poster HTML

<section class="preview-panel">

    <div class="preview-stage">

        <div
            id="poster-preview"
            class="poster"
        >

            <header class="poster-header">

                <h1 id="preview-title">
                    Poster Bastusällskap 2025
                </h1>

                <p id="preview-subtitle">
                    – Vem är vem? –
                </p>

            </header>

            <div
                id="poster-grid"
                class="poster-grid"
            >

            </div>

        </div>

    </div>

</section>


# 80. Current poster preview behavior

Preview supports:

- live title
- live subtitle
- columns
- gap
- visibility
- drag & drop ordering
- hover visibility control
- FIT
- FILL

Preview changes must immediately update CMS where applicable.

Specifically:

Preview reorder

=>

CMS reorder

Preview hide

=>

CMS visibility state

CMS reorder

=>

Preview reorder

CMS hide/show

=>

Preview visibility


# 81. Current CMS behavior

CMS supports:

- title
- subtitle
- participant list
- compact rows
- visibility
- drag & drop
- drop indicator
- poster columns
- poster gap

The CMS is the administrative representation of:

posterState


# 82. Current priority

The most important functionality is:

1. Mobile image capture
2. Crop
3. Name
4. Upload
5. Supabase insert
6. Desktop fetch
7. Desktop display
8. Preview ordering
9. CMS ordering
10. Visibility synchronization

Fancy PDF generation is not a priority.

Authentication is also not a priority and is currently disabled.


# 83. Future features

Potential later features:

- Persistent participant ordering
- Persistent hidden/visible state
- Save poster configuration
- Multiple posters
- Event ID
- Better crop interaction
- Touch drag directly on image
- Desktop drag-and-drop improvements
- Print CSS
- Print button
- PDF generation
- Delete participant
- Edit participant name
- Replace photo
- Undo
- Reset poster
- Poster templates
- Authentication if the project later needs access control


# 84. Current philosophy

Keep it fucking simple.

No React unless there is a real reason.

No unnecessary backend.

No unnecessary abstraction.

No giant framework.

No authentication unless it becomes necessary.

The application is essentially:

HTML

+

CSS

+

vanilla JS

+

Supabase

The mobile app is just a form.

The desktop app is just a tiny CMS + A4 preview.

The database just stores:

name

photo_path

created_at

The storage just stores images.


# 85. UX principle

Mobile user should be able to do:

TA BILD

↓

PLACERA

↓

NÄSTA

↓

NAMN

↓

SPARA

as quickly as possible.

Desktop user should be able to:

FETCH

↓

REORDER

↓

HIDE

↓

EDIT TITLE

↓

PREVIEW A4

↓

PRINT


# 86. Current design principle

Functional first.

90s aesthetic second.

The interface should feel like:

"Someone built a weird but extremely usable piece of 1998 professional event software."

Not:

"Modern website with a retro filter."


# 87. Critical implementation rules

1. There must only be one source of truth for participant ordering:

   posterState.participants

2. CMS and preview must both render from that state.

3. Preview ordering must use visibleIndex because hidden participants are not rendered.

4. CMS ordering must use real array indexes.

5. Do not use participant names as identifiers.

6. After poster rendering, preview drag listeners must exist on the newly created elements.

7. After CMS rendering, CMS drag listeners must exist on the newly created rows.

8. Drop indicators must always be cleared on dragend/drop.

9. Hidden participants remain in posterState.participants.

10. Hiding a participant must immediately update both CMS and preview.

11. Reordering in preview must immediately update CMS.

12. Reordering in CMS must immediately update preview.

13. Thumbnail images in CMS must remain hidden.

14. Hover controls in poster preview should remain hidden until hover.

15. Dragging should provide a clear visual insertion point.

16. No persistent ordering is required yet.

17. No persistent visibility is required yet.

18. Do not introduce React, backend services, or unnecessary dependencies.

19. Do not add authentication unless there is a concrete requirement for it.

20. Supabase RLS and Storage policies are the security boundary.

21. Never expose the Supabase service role key in frontend code.

22. The publishable/anon key may be present in frontend code.

23. App startup must not depend on authentication.


# 88. Current known cleanup opportunity

setupPosterCms() currently does:

setupPosterPreviewDrag();

after:

renderPoster();

But renderPoster() itself ends with:

setupPosterPreviewDrag();

Therefore:

setupPosterPreviewDrag();

inside setupPosterCms()

is redundant.

Preferred implementation:

function setupPosterCms() {

    setupCmsTabs();

    setupPosterStyleControls();

    setupPosterInputs();

    renderParticipants();

    renderPoster();

}

renderPoster() handles preview drag initialization after creating the DOM.


# 89. Current architecture direction

Recommended file separation:

poster-cms.js

Responsibilities:

- renderParticipants()
- setupDragAndDrop()
- moveParticipant()
- clearDropIndicator()
- setupCmsTabs()
- setupPosterStyleControls()
- setupPosterCms()

poster-preview.js

Responsibilities:

- renderPoster()
- setupPosterPreviewDrag()
- moveParticipantFromPreview()
- clearPosterDropIndicator()
- setupPreviewControls()
- setupPosterInputs()

poster-state.js

Responsibilities:

- posterState
- shared state
- state helpers if required

app.js

Responsibilities:

- Supabase
- global state
- views
- initialization
- data loading

photo-form.js

Responsibilities:

- mobile form
- mobile navigation
- upload

photo-comp.js

Responsibilities:

- crop functionality


# 90. Data flow summary

## MOBILE

User

↓

Camera / Upload

↓

photo-form.js

↓

photo-comp.js

↓

Crop

↓

JPEG Blob

↓

Supabase Storage

↓

poster_photos

↓

Supabase participants table


## DESKTOP

Browser

↓

app.js

↓

Supabase

↓

participants

↓

posterState.participants

↓

CMS list

+

Poster preview

↓

User reorder/hide

↓

posterState.participants

↓

CMS + Preview re-render


# 91. Ordering data flow

## CMS reorder

CMS drag

↓

moveParticipant()

↓

posterState.participants

↓

renderParticipants()

↓

renderPoster()

↓

Preview updated


## Preview reorder

Preview drag

↓

moveParticipantFromPreview()

↓

posterState.participants

↓

renderParticipants()

↓

renderPoster()

↓

CMS updated


# 92. Visibility data flow

## CMS

visibility button

↓

participant.visible = !participant.visible

↓

renderParticipants()

↓

renderPoster()


## Preview

visibility button

↓

participant.visible = false

↓

renderParticipants()

↓

renderPoster()


# 93. Supabase data flow

## Fetch

app.js

↓

supabaseClient
    .from("participants")
    .select("*")
    .order("created_at", {
        ascending: true
    })

↓

participants

↓

setParticipants(participants)

↓

posterState


## Upload image

photo-form.js

↓

supabaseClient
    .storage
    .from("poster_photos")
    .upload(...)

↓

poster_photos


## Insert participant

photo-form.js

↓

supabaseClient
    .from("participants")
    .insert({
        name,
        photo_path
    })

↓

participants


# 94. Current app.js structure

Current Supabase initialization:

const SUPABASE_URL =
    "https://nicpgzkkyktzphkyzhfl.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_-u_XwxwKUozPU086NvvKrg_37sY3yXn";

const supabaseClient =
    supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );


Global state:

const state = {
    devMode: false,
    currentView: null
};


Views:

const views = {
    mobile: document.getElementById("mobile-view"),
    desktop: document.getElementById("desktop-view"),
    dev: document.getElementById("dev-view")
};


View switching:

function showView(viewName) {

    Object.values(views).forEach(view => {

        if (view) {
            view.classList.remove("active");
        }

    });

    if (!views[viewName]) {
        return;
    }

    views[viewName].classList.add("active");

    state.currentView = viewName;

    updateDevInfo();
}


View detection:

function detectView() {

    if (state.devMode) {
        return;
    }

    if (window.innerWidth <= 700) {
        showView("mobile");
    } else {
        showView("desktop");
    }
}


# 95. Current participant fetch

Current participant loading:

async function getParticipants() {

    const {
        data,
        error
    } = await supabaseClient
        .from("participants")
        .select("*")
        .order("created_at", {
            ascending: true
        });

    if (error) {

        console.error(
            "Could not load participants:",
            error
        );

        throw error;
    }

    return data;
}


# 96. Current photo URL

Public Storage URL:

function getPhotoUrl(photoPath) {

    const {
        data
    } = supabaseClient
        .storage
        .from("poster_photos")
        .getPublicUrl(photoPath);

    return data.publicUrl;
}


# 97. Current poster loading

Current flow:

async function loadPosterData() {

    try {

        const participants =
            await getParticipants();

        setParticipants(
            participants
        );

        renderParticipants();

        renderPoster();

    } catch (error) {

        console.error(
            "Could not initialize poster:",
            error
        );

    }

}


# 98. Current app initialization

Current init:

function init() {

    console.log(
        "Poster Tool starting..."
    );

    detectView();

    setupPreviewControls();

    setupPosterInputs();

    loadPosterData();

}

init();

Det finns ingen authentication-check innan init().

Appen ska starta direkt.


# 99. Final mental model

The entire desktop system should be thought of as:

                    posterState

                        |

              participants[]

                        |

          +-------------+-------------+

          |                           |

          v                           v

     CMS participant list       Poster preview

          |                           |

       drag/drop                  drag/drop

       visibility                 visibility

          |                           |

          +-------------+-------------+

                        |

                        v

                 posterState

                        |

                        v

                 re-render both


There should never be a separate "CMS order"

and "preview order".

There should only be one participant array.

That is the core principle for keeping the application simple and predictable.


# 100. Final security model

The current project intentionally does NOT use authentication.

Security is handled by:

Supabase publishable key

+

RLS

+

Storage policies

The frontend is public.

Therefore anyone who has access to the application can potentially call the allowed Supabase operations.

That is acceptable for the current event use case.

If the application later needs real access control, authentication can be reintroduced.

Until then:

DO NOT build unnecessary auth.

DO NOT build an Edge Function just for password checking.

DO NOT add a backend server.

Keep the architecture:

Browser

↓

Supabase publishable client

↓

RLS-protected database

+

Public image storage


# 101. Core principle

KEEP IT FUCKING SIMPLE.

The app is:

A mobile participant uploader

+

A desktop poster CMS

+

An A4 poster preview

+

Supabase

Nothing more unless the project actually needs it.