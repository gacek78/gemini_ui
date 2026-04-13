# SmartCompanion (Gemini UI)

**SmartCompanion** to nowoczesny interfejs chat-owy bazujący na Google Gemini API, dający Ci pełną, lokalną kontrolę i prywatność nad historią Twoich rozmów. System stworzono zgodnie z wzorcem **Self-Hosted** i wsparciem na przynieś własny klucz **(Bring Your Own Key - BYOK)**, który szyfrowany jest na poziomie własnego serwera. W pełni multimodalny interfejs oferuje strumieniowanie zapytań (streaming), obsługę załączników, generowanie historii z automatycznymi podsumowaniami i odpytywanie Internetu w czasie rzeczywistym.

## Wymagania systemowe

Aby poprawnie zbudować i uruchomić ten projekt potrzebujesz:
- **Node.js** w wersji LTS (np. v20.x+)
- **NPM** lub wybranego managera pakietów
- **Docker** oraz **Docker Compose** dla łatwej instalacji bazy postgresql

## Instalacja

Sklonuj repozytorium i wykonaj poniższe komendy do instalacji pakietów klienckich:

```bash
npm install
```

## Konfiguracja Zmiennych Środowiskowych

1. Skopiuj plik `.env.example` lub stwórz świeży plik `.env` w głównym katalogu
2. Wymagane są następujące zmienne (lub dostosuj istniejące):
   - `DATABASE_URL` – Ścieżka połączenia z bazą PostgreSQL
   - `AUTH_SECRET` – Główne, tajne hasło do szyfrowania sesji bazy (zalecana generacja poprzez `openssl rand -base64 32`)
   - `ENCRYPTION_KEY` – 32-bajtowy klucz kodowany w base64, wykorzystywany do silnego szyfrowania w bazi Twojego klucza prywatnego Gemini. (Wygeneruj komendą w terminalu: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`)

Do domyślnego Docker Compose w projekcie, poprawny url brzmi:
`DATABASE_URL="postgresql://postgres:postgres@localhost:5432/geminidb?schema=public"`

## Uruchomienie Bazy Danych

Rozpocznij proces bazy polegający na standardowym środowisku instalacji:

```bash
# Odpal kontener
docker-compose up -d

# Podnieś schemat Prisma. Oczekuj chwilę od spięcia kontenera przed wykonaniem:
npx prisma generate
npx prisma db push
```

## Uruchomienie Aplikacji

By podnieść serwer deweloperski wydaj komendę:
```bash
npm run dev
```
Użytkowo otwiera stronę [http://localhost:3000](http://localhost:3000)

Domyślnie możesz się zalogować adresami e-mail takimi jak np. `test@example.com` (Hasło czy Provider ujęty w `auth.ts` nie stawia wymagań podczas implementacji testowej).
Wewnątrz ustawień (Settings) załącz swój wygenerowany **Google Gemini API Key**. 

## Tryb zoptymalizowany

Do publikowania i instalacji na domowym NAS (np. host, OMV):
```bash
npm run build
npm start
```
