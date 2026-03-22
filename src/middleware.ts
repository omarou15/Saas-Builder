import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Routes qui nécessitent une authentification
const isProtectedRoute = createRouteMatcher([
  "/app(.*)", // dashboard + workspace + toutes les sous-routes
]);

// Routes publiques explicites (inutile de lister, mais clarifie l'intention)
// "/", "/sign-in(.*)", "/sign-up(.*)", "/api/webhooks/(.*)"

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Exclure les fichiers Next.js internes et les assets statiques
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Toujours exécuter pour les API routes
    "/(api|trpc)(.*)",
  ],
};
