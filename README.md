# Gridfinity 3D Model Generator

Een webapplicatie om 3D modellen voor Gridfinity te genereren op basis van foto's met een A4 referentie.

## 🎯 Functionaliteit

Deze applicatie biedt een eenvoudige manier om Gridfinity-compatibele STL bestanden te maken:

- Upload een foto van je object naast een A4 papier
- De app detecteert automatisch de schaal aan de hand van het A4 papier
- Genereer een Gridfinity-compatibel 3D model (STL bestand)
- Download het model om te 3D printen

## 📋 Vereisten

- Node.js (versie 14 of hoger)
- npm

## 🚀 Installatie

1. Clone de repository:
```bash
git clone https://github.com/Loekiboy/infinty-grid-auto.git
cd infinty-grid-auto
```

2. Installeer dependencies:
```bash
npm install
```

3. Start de server:
```bash
npm start
```

4. Open je browser en ga naar:
```
http://localhost:3000
```

## 📸 Gebruik

1. **Maak een foto:**
   - Plaats je object naast een A4 papier
   - Maak een foto van bovenaf
   - Zorg dat het A4 papier volledig zichtbaar is in de foto

2. **Upload de foto:**
   - Klik op het upload gebied of sleep je foto erin
   - Ondersteunde formaten: JPG, PNG (max 10MB)

3. **Genereer het model:**
   - Klik op "Genereer 3D Model"
   - Wacht tot de verwerking compleet is

4. **Download:**
   - Download het gegenereerde STL bestand
   - Print het met je 3D printer

## 🔧 Technische Details

### Gridfinity Specificaties

- Basis unit: 42mm × 42mm
- Basis hoogte: 7mm
- Magneet gaten: 6.5mm diameter, 2.5mm diep
- Wanddikte: 1.5mm

### Stack

- **Backend:** Node.js + Express
- **Image Processing:** Sharp
- **3D Modeling:** JSCAD
- **Frontend:** Vanilla HTML/CSS/JavaScript

## 📝 Notities

Dit is een **basis implementatie** gebaseerd op de kern functionaliteit van tooltrace.ai. De huidige versie:

- Gebruikt een vereenvoudigde A4 detectie
- Schat objectafmetingen op basis van fotoafmetingen
- Genereert standaard Gridfinity bins met magneet gaten
- Ondersteunt geen geavanceerde functies zoals meervoudige foto's of complexe objectdetectie

Voor productie gebruik zou de volgende functionaliteit toegevoegd kunnen worden:
- Computer vision voor nauwkeurige A4 detectie
- Meerdere foto's voor betere 3D reconstructie
- Handmatige aanpassing van afmetingen
- Geavanceerde bin configuraties
- Object segmentatie en vorm detectie

## 📄 Licentie

ISC
