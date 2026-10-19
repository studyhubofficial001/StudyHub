# StudyHub

## Install dependencies

The client and server are separate npm projects, each with its own lockfile.
Run `npm install` from each project directory:

```powershell
cd client
npm install
cd ..\server
npm install
```

Do not run `npm install` from the repository root. Start the client with
`npm run dev` from `client`, or the server with `npm run start` from `server`.
