# Platform Guide

Platform Guide is a web-based mapping tool designed to help railway station administrators visually define, organize, and publish the layout of a railway station. The output is a fully interactive, read-only "Traveler View" that commuters can use to navigate platforms, find services (like washrooms and ticket counters), and understand connectivity infrastructure (bridges, foot-over-bridges, walkways, gates).

## Features

- **Admin Workflow**:
  - Define geographical station boundaries.
  - Draw custom polygons for individual platforms.
  - Place interactive service markers mapped to platforms.
  - Map out connective infrastructure like bridges and gates.
  - Preview generated map via Traveler View.
- **Traveler View (Commuter Mode)**:
  - Read-only interface for commuters.
  - Global Search and Category Filters.
  - Distance calculation using GPS.

## Tech Stack

- **Frontend**: HTML5, Vanilla JavaScript, Tailwind CSS
- **Map Engine**: Leaflet.js with Leaflet.Draw
- **Tiles**: CartoDB Light & OpenRailwayMap
- **Geocoding**: Nominatim & Overpass API (OSM)
- **Data Storage**: Client-side `localStorage` (No backend required)

## Installation & Usage

1. Clone the repository.
2. Open `index.html` in your web browser.
3. Manage stations, draw platforms, and configure services entirely within the browser!
