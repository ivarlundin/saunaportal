# Event Poster Tool — Project Context

## 1. Projektöversikt

Detta är en superenkel statisk webbapp för ett event.

Syftet är:

1. På mobil:
   - Ta foto på en deltagare
   - Alternativt ladda upp en befintlig bild
   - Croppa/positionera bilden
   - Skriva deltagarens namn
   - Ladda upp bilden + namn till Supabase

2. På desktop:
   - Hämta alla deltagare från Supabase
   - Visa bilder och namn
   - Ändra ordningen
   - Dölja deltagare
   - Ändra titel och undertext
   - Visa en live-preview av en A4-poster
   - Senare kunna skriva ut / skapa PDF

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

Externa dependencies:

- Supabase JS client via CDN

Supabase används för:

- PostgreSQL database
- Storage bucket för bilder

Frontend kommunicerar direkt med Supabase från browsern.

Ingen egen API-server.


# 3. Git

Repository har:

main
dev

Tanken är:

main
- Stabil version
- Det som ligger live

dev
- All utveckling
- Nya features
- Experiment

Ändringar ska normalt göras på dev.

När allt fungerar:
dev -> main via merge / pull request.


# 4. Supabase

Supabase project URL:

https://nicpgzkkyktzphkyzhfl.supabase.co

REST API base:

https://nicpgzkkyktzphkyzhfl.supabase.co/rest/v1/

Frontend använder Supabase publishable key.

Publishable key är avsedd att ligga i browserkod.

Det är viktigt att RLS + policies används korrekt.

Service role key ska ALDRIG läggas i frontend.


# 5. Supabase Storage

Bucket:

poster_photos

Bucket är:

PUBLIC

Nuvarande storage:

poster_photos

Max filstorlek som visas i dashboard:

50 MB

Vanliga iPhone-bilder kommer inte i närheten av detta och projektet förväntas bara ha ungefär 50 bilder per event.

Bilderna laddas upp till:

poster_photos/<filename>


# 6. Supabase Database

Tabell:

participants

Förväntade fält:

id
name
photo_path
created_at

Exempel:

id:
UUID / primary key

name:
text

photo_path:
text

created_at:
timestamp


# 7. RLS / policies

RLS ska vara aktiverat.

Eftersom appen är statisk och mobilformuläret ska kunna användas publikt behöver vi policies som tillåter det vi faktiskt vill göra.

Nuvarande funktioner kräver:

INSERT participants
SELECT participants

Storage kräver:

INSERT/upload till poster_photos
SELECT/read poster_photos

Bucketen är public så bilderna kan läsas via public URL.

Vi använder publishable/anon-klienten i frontend.


# 8. index.html

index.html innehåller tre huvudsakliga views:

1. mobile-view
2. desktop-view
3. dev-view

Supabase JS laddas från CDN.

Scripts laddas med defer.

Nuvarande scriptordning:

<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

<script src="photo-comp.js" defer></script>
<script src="photo-form.js" defer></script>
<script src="app.js" defer></script>

Supabase CDN-scriptet behöver vara tillgängligt innan våra scripts kör Supabase-initiering.

Defer innebär att scripts laddas parallellt men exekveras efter HTML-parsningen i dokumentordning.


# 9. Mobile UX

Mobilen är uppbyggd som ett steg-för-steg-flöde.

Steg 1:

TA BILD

eller

LADDA UPP BILD


Steg 2:

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


Steg 3:

ÄR BILDEN KLAR?

Här visas den färdiga beskurna bilden.

Användaren skriver:

Namn

och klickar:

Spara deltagare


# 10. Mobile navigation

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


# 11. Photo input

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


# 12. Photo cropping

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


# 13. Temporary crop

Efter crop sparas resultatet temporärt:

window.croppedPhotoBlob

Denna Blob laddas först upp när användaren trycker:

Spara deltagare


# 14. Upload

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


# 15. Desktop CMS

Desktop view består av två huvuddelar:

Vänster:

CMS panel

Höger:

Poster preview


Layout:

desktop-layout

grid:

380px + resten


# 16. CMS

CMS-panelen ska innehålla:

Logo

Titel-input

Undertext-input

Deltagarlista


Titel:

id="poster-title"

Placeholder:

Möckelsnäs Bastusällskap 2025


Undertext:

id="poster-subtitle"

Placeholder:

– Vem är vem? –


När inputs ändras ska poster-preview uppdateras direkt.


# 17. Participants CMS

Alla deltagare hämtas från:

participants

Sortering:

created_at ascending


Deltagarlistan ska visa:

- drag handle
- thumbnail
- namn
- visibility button


Exempel:

☰
[bild]
Ivar
👁


Deltagare ska kunna:

- flyttas
- döljas
- visas igen


Döljning är för närvarande lokal poster-state och behöver inte direkt uppdatera databasen.


# 18. Ordering

Nuvarande ordering hanteras i:

posterState.participants

Drag and drop används.

När en deltagare flyttas:

1. splice ut objektet
2. splice in på ny position
3. renderParticipants()
4. renderPoster()


Nuvarande ordering behöver senare eventuellt kunna sparas om vi vill att posterlayouten ska vara persistent.


# 19. Poster state

Nuvarande state:

const posterState = {
    title: "",
    subtitle: "",
    participants: []
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


# 20. Poster preview

Poster preview ska representera exakt A4.

CSS:

width: 210mm;
height: 297mm;

aspect ratio:

210 / 297


Poster:

<div id="poster-preview" class="poster">


Poster header:

<header class="poster-header">

    <h1 id="preview-title">
        Möckelsnäs Bastusällskap 2025
    </h1>

    <p id="preview-subtitle">
        – Vem är vem? –
    </p>

</header>


Poster grid:

<div id="poster-grid" class="poster-grid">
</div>


# 21. Poster grid

Poster grid visar alla deltagare som är visible.

Varje person:

bild

namn


Exempel:

[ IMAGE ]
Ivar


Grid är för närvarande:

4 columns

Bilderna har:

aspect-ratio: 4 / 5

object-fit:

cover


# 22. Preview modes

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


# 23. PDF / Print

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


# 24. Logo

En logo finns i samma directory:

my-sauna-portal-logo.png

Den ska visas:

Mobile:
- i mobile header

Desktop:
- i CMS-panelen till vänster


Logotypen ska inte dominera.

# 25. Design language

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


# 26. Ta bild-knappen

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

Nuvarande design använder gradient + inset shadows + hård drop shadow.


# 27. Ladda upp bild-knappen

Sekundärknappen heter:

Ladda upp bild

Den ska vara:

- mindre
- grå/silver
- samma 90s hardware-system
- mindre visuellt dominant än Ta bild


# 28. Important CSS note

Ta bild-knappen hade tidigare en dekorativ ::after med små pixelliknande block nere i högra hörnet.

Detta togs bort eftersom det såg ut som en bugg.

Använd därför INTE den dekorationen.


# 29. app.js

app.js ska helst hålla:

- Supabase initialization
- global app state
- view detection
- mobile/desktop switching
- dev mode
- loading participants
- poster state
- desktop CMS rendering
- poster rendering
- drag and drop
- preview mode

Om app.js blir för stor ska logik flyttas till separata scripts.


# 30. Dev mode

Dev mode aktiveras genom:

Enter två gånger snabbt.

När dev mode är aktivt visas:

Dev mode


Dev mode visar:

Viewport
Current view


Och buttons:

Mobile
Desktop


Dev mode ska kunna användas för att testa mobile UI på desktop.


# 31. View detection

Automatiskt:

window.innerWidth <= 700

=> mobile

annars:

desktop


I dev mode sker ingen automatisk view switching.


# 32. Current HTML structure

Main:

<main id="app">


Mobile:

<section id="mobile-view" class="view">


Desktop:

<section id="desktop-view" class="view">


Dev:

<section id="dev-view" class="view">


# 33. Mobile HTML structure

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


# 34. Desktop HTML structure

desktop-layout

cms-panel

preview-panel


cms-panel:

cms-header
poster-settings
participants-header
participants-list


preview-panel:

poster

poster-header
poster-grid


# 35. Important file ownership

FRAMÖVER SKA DET ALLTID VARA TYDLIGT VILKEN FIL SOM SKA ÄNDRAS.

Grundregel:

app.js
- app / Supabase / desktop / global state / view system

photo-form.js
- mobile form
- mobile steps
- name
- upload
- submit

photo-comp.js
- crop image
- zoom
- positioning
- crop generation
- overlay/crop calculations

styles.css
- all styling

index.html
- markup / structure


# 36. Current photo-form responsibilities

photo-form.js:

- get form elements
- get photo input
- get upload input
- handle camera image
- handle uploaded image
- navigate steps
- call loadCropImage()
- call createCroppedImage()
- show final preview
- upload blob
- insert participant
- reset form
- status messages


# 37. Current photo-comp responsibilities

photo-comp.js should contain cropper logic.

Expected public functions:

loadCropImage(file)

createCroppedImage()


Potential internal state:

cropState = {
    image,
    scale,
    x,
    y,
    ...
}


# 38. Important browser compatibility

The app must work on iPhone Safari.

Previously:

crypto.randomUUID()

did not work in the local Live Server environment.

Therefore file names currently use:

Date.now() + Math.random()

instead of relying on crypto.randomUUID().


# 39. Static deployment

Final deployment target:

GitHub Pages

Everything must work as static files.

No server runtime.

No build step.

No environment variables required at runtime unless GitHub Pages configuration later requires them.

Supabase publishable key can be exposed in frontend.

Never expose:

Supabase service_role key


# 40. Data flow

MOBILE:

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


DESKTOP:

Browser
↓
app.js
↓
Supabase
↓
participants
↓
participant objects
↓
CMS list
↓
Poster state
↓
HTML A4 preview
↓
Print / Save as PDF


# 41. Current priority

The most important functionality is:

1. Mobile image capture
2. Crop
3. Name
4. Upload
5. Supabase insert
6. Desktop fetch
7. Desktop display

If these don't work, do not spend time on fancy PDF generation or advanced CMS features.


# 42. Future features

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


# 43. Current philosophy

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


# 44. UX principle

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


# 45. Current design principle

Functional first.

90s aesthetic second.

The interface should feel like:

"Someone built a weird but extremely usable piece of 1998 professional event software."

Not:

"Modern website with a retro filter."