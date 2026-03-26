# Plan Działania (Roadmap): `gemini_ui`

Poniżej znajduje się szczegółowy, ułożony chronologicznie plan wdrożenia aplikacji. Skupiamy się na modelu dostarczania przez użytkownika własnego klucza API (Bring Your Own Key) oraz utrzymywaniu operacji w całości na własnym serwerze (Self-Hosted).

## Faza 1: Inicjalizacja Środowiska i Bazy Danych
- [x] **Etap 1.1**: Założenie projektu na serwerze (inicjalizacja repozytorium, Node.js/Python).
- [x] **Etap 1.2**: Konfiguracja bazy danych (np. PostgreSQL) za pomocą narzędzi typu Prisma, Drizzle, lub SQLAlchemy (w zależności od stosu technologicznego).
- [x] **Etap 1.3**: Zaprojektowanie schematu bazy: Tabele `Users`, `Conversations` (Wątki), `Messages` (Wiadomości) oraz `UserSettings` (w tym pole na zaszyfrowany klucz API, `temperature`, `max_tokens` itp.).
- [x] **Etap 1.4**: Wdrożenie autoryzacji (Logowanie e-mail/hasło lub OAuth) chroniącej panel.

## Faza 2: Połączenie Serwera z Gemini API (Backend)
- [x] **Etap 2.1**: Instalacja zestawu SDK od Google (np. `@google/generative-ai` w JS lub `google-generativeai` w Pythonie).
- [x] **Etap 2.2**: Opracowanie serwisu szyfrującego klucze (AES-256) przed zrzutem do bazy. Stworzenie endpointu deszyfrowania w locie przy wysyłaniu zapytania do Google.
- [x] **Etap 2.3**: Zbudowanie endpointu `/api/chat` obsługującego wysyłkę zapytań z podstawowymi ustawieniami.
- [x] **Etap 2.4**: Zaimplementowanie strumieniowania odpowiedzi z backendu (Server-Sent Events) pozwalającego na "pisanie" tekstu w locie.

## Faza 3: Interfejs Użytkownika (Frontend)
- [x] **Etap 3.1**: Instalacja frameworka dla interfejsu klienta (Next.js/React z Tailwind CSS).
- [x] **Etap 3.2**: Budowa okna wprowadzania ustawień (`Settings UI`), gdzie użytkownik wprowadza:
  - Własny klucz API Google.
  - Opcje modelu, jak kreatywność (`temperature`).
  - Domyślny instruktarz systemowy ("Persona" asystenta).
- [x] **Etap 3.3**: Okno Chat: stworzenie paska historii rozmów, dynamicznego dodawania nowych wątków.
- [x] **Etap 3.4**: Pole wprowadzania wiadomości i okno rozmowy (Renderowanie Markdown, stylizacja).
- [x] **Etap 3.5**: Konfiguracja przesyłu stanu na żywo (Strumieniowanie okna chatu).

## Faza 4: Zarządzanie Kontekstem
- [x] **Etap 4.1**: Stworzenie logiki pamięci kontekstu - formatowanie historii wiadomości do formatu struktury Gemini (`[{role: 'user', parts: ...}, ...]`).
- [x] **Etap 4.2**: Mechanizm skracania starszych wiadomości, jeśli ciąg zapytań staje się zbyt długi (Slide-window context memory).

## Faza 5: Zaawansowane Funkcje Multimodalne (Etap Opcjonalny lub Rozbudowujący)
- [x] **Etap 5.1**: Obsługa plików (obrazów) - przesył, konwersja do Base64 i analiza przez Gemini.
- [x] **Etap 5.2**: Wprowadzenie narzędzi (`Google Search / Grounding`). Automatyczna weryfikacja faktów w sieci i wyświetlanie źródeł.
- [ ] **Etap 5.3**: Generowanie obrazów. (Pominięto na prośbę użytkownika)
