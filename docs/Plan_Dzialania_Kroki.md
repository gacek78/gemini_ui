# Plan Działania (Roadmap): `gemini_ui`

Poniżej znajduje się szczegółowy, ułożony chronologicznie plan wdrożenia aplikacji. Skupiamy się na modelu dostarczania przez użytkownika własnego klucza API (Bring Your Own Key) oraz utrzymywaniu operacji w całości na własnym serwerze (Self-Hosted).

## Faza 1: Inicjalizacja Środowiska i Bazy Danych
- [ ] **Etap 1.1**: Założenie projektu na serwerze (inicjalizacja repozytorium, Node.js/Python).
- [ ] **Etap 1.2**: Konfiguracja bazy danych (np. PostgreSQL) za pomocą narzędzi typu Prisma, Drizzle, lub SQLAlchemy (w zależności od stosu technologicznego).
- [ ] **Etap 1.3**: Zaprojektowanie schematu bazy: Tabele `Users`, `Conversations` (Wątki), `Messages` (Wiadomości) oraz `UserSettings` (w tym pole na zaszyfrowany klucz API, `temperature`, `max_tokens` itp.).
- [ ] **Etap 1.4**: Wdrożenie autoryzacji (Logowanie e-mail/hasło lub OAuth) chroniącej panel.

## Faza 2: Połączenie Serwera z Gemini API (Backend)
- [ ] **Etap 2.1**: Instalacja zestawu SDK od Google (np. `@google/generative-ai` w JS lub `google-generativeai` w Pythonie).
- [ ] **Etap 2.2**: Opracowanie serwisu szyfrującego klucze (AES-256) przed zrzutem do bazy. Stworzenie endpointu deszyfrowania w locie przy wysyłaniu zapytania do Google.
- [ ] **Etap 2.3**: Zbudowanie endpointu `/api/chat` obsługującego wysyłkę zapytań z podstawowymi ustawieniami.
- [ ] **Etap 2.4**: Zaimplementowanie strumieniowania odpowiedzi z backendu (Server-Sent Events) pozwalającego na "pisanie" tekstu w locie.

## Faza 3: Interfejs Użytkownika (Frontend)
- [ ] **Etap 3.1**: Instalacja frameworka dla interfejsu klienta (Next.js/React z Tailwind CSS).
- [ ] **Etap 3.2**: Budowa okna wprowadzania ustawień (`Settings UI`), gdzie użytkownik wprowadza:
  - Własny klucz API Google.
  - Opcje modelu, jak kreatywność (`temperature`).
  - Domyślny instruktarz systemowy ("Persona" asystenta).
- [ ] **Etap 3.3**: Okno Chat: stworzenie paska historii rozmów, dynamicznego dodawania nowych wątków.
- [ ] **Etap 3.4**: Pole wprowadzania wiadomości i okno rozmowy (Renderowanie Markdown, stylizacja).
- [ ] **Etap 3.5**: Konfiguracja przesyłu stanu na żywo (Strumieniowanie okna chatu).

## Faza 4: Zarządzanie Kontekstem
- [ ] **Etap 4.1**: Stworzenie logiki pamięci kontekstu - formatowanie historii tabeli `Messages` do formatu struktury Gemini (`[{role: 'user', parts: ...}, ...]`).
- [ ] **Etap 4.2**: Mechanizm skracania starszych wiadomości, jeśli ciąg zapytań staje się zbyt długi (Slide-window context memory).

## Faza 5: Zaawansowane Funkcje Multimodalne (Etap Opcjonalny lub Rozbudowujący)
- [ ] **Etap 5.1**: Obsługa przeciągania plików z dysku do ekranu aplikacji. Proces przesyłu i konwersji do Base64/do zaplecza, wysyłka do Gemini z parametrem widzenia.
- [ ] **Etap 5.2**: Wprowadzenie narządzi (`Function Calling`). Wdrożenie i zakodowanie Google Custom Search po stronie zaplecza.
- [ ] **Etap 5.3**: Generowanie obrazów. Logika rozpoznawania zapytań typu "narysuj coś" i ewentualnie użycia drugiego zewnętrznego integratora API.
