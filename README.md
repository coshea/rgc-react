# Vite & HeroUI Template

This is a template for creating applications using Vite and HeroUI (v2).

[Try it on CodeSandbox](https://githubbox.com/frontio-ai/vite-template)

## Technologies Used

- [Vite](https://vitejs.dev/guide/)
- [HeroUI](https://heroui.com)
- [Tailwind CSS](https://tailwindcss.com)
- [Tailwind Variants](https://tailwind-variants.org)
- [TypeScript](https://www.typescriptlang.org)
- [Framer Motion](https://www.framer.com/motion)

## How to Use

To clone the project, run the following command:

```bash
git clone https://github.com/frontio-ai/vite-template.git
```

### Install dependencies

You can use one of them `npm`, `yarn`, `pnpm`, `bun`, Example using `npm`:

```bash
npm install
```

### Run the development server

```bash
npm run dev
```

### Enable React Query Devtools in non-dev environments

By default the React Query Devtools are only shown in development. To enable them in another environment (for example a staging build), set the Vite env variable `VITE_ENABLE_REACT_QUERY_DEVTOOLS` to `true` when building or serving:

```powershell
# Windows PowerShell example
$env:VITE_ENABLE_REACT_QUERY_DEVTOOLS = 'true'; npm run dev

# or for a production build
$env:VITE_ENABLE_REACT_QUERY_DEVTOOLS = 'true'; npm run build && npm run preview
```

In Vite you can also create a `.env.staging` file with:

```
VITE_ENABLE_REACT_QUERY_DEVTOOLS=true
```

and then run `vite` with that mode: `vite --mode staging`.

### Setup pnpm (optional)

If you are using `pnpm`, you need to add the following code to your `.npmrc` file:

```bash
public-hoist-pattern[]=*@heroui/*
```

After modifying the `.npmrc` file, you need to run `pnpm install` again to ensure that the dependencies are installed correctly.

## License

Licensed under the [MIT license](https://github.com/frontio-ai/vite-template/blob/main/LICENSE).
