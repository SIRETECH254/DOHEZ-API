# 📄 E-Commerce API - Swagger Documentation

## 📋 Table of Contents
- [Swagger Overview](#swagger-overview)
- [Implemented Modules (Swagger Documented)](#implemented-modules-swagger-documented)
- [Setup and Configuration](#setup-and-configuration)
- [Documenting Endpoints (JSDoc)](#documenting-endpoints-jsdoc)
- [Viewing the Documentation](#viewing-the-documentation)
- [Swagger UI Features](#swagger-ui-features)
- [Troubleshooting](#troubleshooting)
- [Adding New Modules](#adding-new-modules)

---

## Swagger Overview

This document explains how the E-Commerce API uses Swagger (OpenAPI) to automatically generate interactive API documentation. The documentation is generated from JSDoc comments within the route files and a central configuration file.

**Key Benefits:**
- **Interactive UI:** Provides a user-friendly interface to visualize and interact with the API's resources.
- **Auto-generated:** Documentation is kept up-to-date with code changes by parsing JSDoc comments.
- **Testable Endpoints:** Allows direct testing of API endpoints from the browser.
- **Standardized:** Follows the OpenAPI 3.0 specification, making it easily consumable by other tools.

---

## Implemented Modules (Swagger Documented)

Modules and their respective endpoints will be documented here as they are implemented in the codebase. Each module will include a brief overview, base path, and illustrative JSDoc snippets.

*(Currently empty. Modules will be added as implementation progresses.)*

---

## Setup and Configuration

Swagger documentation is configured in `src/config/swagger.ts`. This file defines the basic API information, server details, security schemes, and the paths where Swagger-JSdoc should look for API definitions.

**File: `src/config/swagger.ts`**
```typescript
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "E-Commerce API",
      version: "1.0.0",
      description: "E-Commerce API server for managing marketplace operations",
      contact: { name: "E-Commerce API Support", email: "support@dohez.com" },
      license: { name: "MIT", url: "https://opensource.org/licenses/MIT" }
    },
    servers: [
      {
        url: process.env.NODE_ENV === "production"
            ? process.env.API_BASE_URL || "https://api.dohez.com"
            : `http://localhost:${process.env.PORT || 4500}`,
        description: process.env.NODE_ENV === "production" ? "Production server" : "Development server"
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter your Bearer token in the format: Bearer <token>"
        }
      }
    },
    tags: []
  },
  apis: ["./src/routes/*.ts"]
};

const specs = swaggerJsdoc(options);

const swaggerConfig = {
  swaggerUi,
  specs,
  options: {
    explorer: true,
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "E-Commerce API Documentation"
  }
};

export default swaggerConfig;
```

The `apis` array is crucial as it tells `swagger-jsdoc` which files to parse for JSDoc comments containing OpenAPI definitions. For this project, all route definitions are expected to be in `src/routes/*.ts`.

---

## Documenting Endpoints (JSDoc)

API endpoints are documented using JSDoc comments directly above their route definitions in the `src/routes` directory. These comments follow the OpenAPI 3.0 specification and are parsed by `swagger-jsdoc` to build the API documentation.

### General Structure

```typescript
/**
 * @swagger
 * /api/your-path:
 *   method:
 *     summary: A short summary of the endpoint's purpose.
 *     tags: [YourTag]
 *     description: |
 *       A more detailed description of the endpoint.
 *       Use markdown for rich text.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       "200":
 *         description: Success response description.
 */
router.method("/api/your-path", middleware, controllerFunction);
```

---

## Viewing the Documentation

To view the generated Swagger documentation:

1.  **Ensure the API server is running.**
    ```bash
    npm run dev
    ```
2.  **Open your web browser** and navigate to:
    ```
    http://localhost:4500/api/docs
    ```

---

## Swagger UI Features

-   **Endpoint List:** All documented API endpoints are listed and grouped by tags.
-   **Expand/Collapse:** Click on an endpoint to expand its details.
-   **"Try it out" Button:** For each endpoint, you can click "Try it out" to send a request directly from the UI.
-   **Authorize:** If a `bearerAuth` security scheme is defined, you can click the "Authorize" button at the top right, enter your JWT token, and it will be included in subsequent requests.

---

## Troubleshooting

-   **"No operations defined in spec!"**:
    -   Ensure your API server is running.
    -   Verify that `src/config/swagger.ts`'s `apis` array correctly points to your route files.
-   **Routes not appearing/outdated**:
    -   Restart your API server after making changes to JSDoc comments or `swagger.ts`.
-   **Authentication issues ("Unauthorized")**:
    -   Ensure you have provided a valid JWT token in the "Authorize" dialog.

---

## Adding New Modules

1.  **Create the Route File:** Add your new route definitions in `src/routes/yourNewModuleRoutes.ts`.
2.  **Update `swagger.ts` (Optional but Recommended):** Add a new tag to the `tags` array in `src/config/swagger.ts` for your new module.
3.  **Document Endpoints:** Add detailed JSDoc comments directly above each route definition.
4.  **Restart Server:** Restart your API server (`npm run dev`) to regenerate the Swagger documentation.

---

**Last Updated:** April 2026
**Version:** 1.0.0
**Maintainer:** E-Commerce API Development Team
