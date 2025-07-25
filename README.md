# bitespeed-identity-reconciliation
# Customer Identity Reconciliation API

This is a backend service built for the BiteSpeed task, designed to reconcile customer identities based on their contact information (email and phone number). It links different orders from the same person even if they use varying contact details, consolidating them under a primary contact.

## Features

* **Identity Reconciliation:** Links primary and secondary contact details.
* **Dynamic Linking:** Handles scenarios where existing primary contacts might become secondary if a newer link merges them.
* **API Endpoint:** Provides a `/identify` endpoint to process contact information.

## Tech Stack

* **Backend:** Node.js, Express.js (TypeScript)
* **Database:** SQLite (for local development/testing)
* **ORM:** Prisma

## Getting Started Locally

Follow these steps to set up and run the project on your local machine.

### Prerequisites

* Node.js (v18 or higher recommended)
* npm (Node Package Manager)

### Installation

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/vatan-prakash/bitespeed-identity-reconciliation.git](https://github.com/YOUR_USERNAME/bitespeed-identity-reconciliation.git)
    cd bitespeed-identity-reconciliation
    ```
 

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up the database (SQLite):**
    * Create a `.env` file in the project root with the following content:
        ```
        DATABASE_URL="file:./dev.db"
        ```
    * Ensure your `prisma/schema.prisma` file's `datasource db` block looks like this:
        ```prisma
        datasource db {
          provider = "sqlite"
          url      = env("DATABASE_URL")
        }
        ```
    * Run Prisma migrations to create the database file (`dev.db`) and table:
        ```bash
        npx dotenv prisma migrate dev --name init
        ```
        (When prompted, enter a migration name like `init` and press Enter.)

### Running the Application

1.  **Start the development server:**
    ```bash
    npm run dev
    ```
    Your API will be running on `http://localhost:3000`.

## API Endpoint: `/identify`

This endpoint accepts `POST` requests to identify and reconcile contact information.

* **URL:** `http://localhost:3000/identify`
* **Method:** `POST`
* **Content-Type:** `application/json`
* **Request Body:**
    ```json
    {
        "email"?: string,       // Optional: Customer's email address
        "phoneNumber"?: string  // Optional: Customer's phone number
    }
    ```
    *(At least one of `email` or `phoneNumber` must be provided and be a string or `null`.)*

* **Success Response (Status: 200 OK):**
    ```json
    {
        "contact": {
            "primaryContatctId": number,
            "emails": string[],        // All unique emails linked to the primary contact
            "phoneNumbers": string[],  // All unique phone numbers linked to the primary contact
            "secondaryContactIds": number[] // IDs of all secondary contacts
        }
    }
    ```

### Testing the API Locally (using Postman or PowerShell)

1.  **Ensure your server is running** (`npm run dev` in one terminal).
2.  **Open Postman** (or a new PowerShell terminal for `Invoke-RestMethod`).
3.  **Database Reset for Isolated Tests (Important!):**
    For scenarios that require a clean database state (like merging two primaries), follow these steps:
    * Stop the server (Ctrl+C).
    * Delete `dev.db` and `prisma/migrations` folders.
    * Run `npx dotenv prisma migrate dev --name init` (and restart server).

#### Example Test Cases:

**1. New Contact Creation:**
* **JSON Body:**
    ```json
    { "email": "lorraine@hillvalley.edu", "phoneNumber": "123456" }
    ```
* **Expected:** Primary contact ID 1, no secondaries.

**2. Add New Email to Existing Phone:** (Continue from above, do NOT reset)
* **JSON Body:**
    ```json
    { "email": "mcfly@hillvalley.edu", "phoneNumber": "123456" }
    ```
* **Expected:** Primary ID 1, secondary ID 2, both emails listed.

**3. Merging Two Primary Contacts:** (Requires database reset before starting this sequence)
* **Request 1 (Primary 1):**
    ```json
    { "email": "george@hillvalley.edu", "phoneNumber": "919191" }
    ```
* **Request 2 (Primary 2):**
    ```json
    { "email": "biffsucks@hillvalley.edu", "phoneNumber": "717171" }
    ```
* **Request 3 (Link them):**
    ```json
    { "email": "george@hillvalley.edu", "phoneNumber": "717171" }
    ```
* **Expected:** Primary ID 1 (george), secondary ID 2 (biffsucks), both emails and phones consolidated.

*(Include other edge cases as you see fit after testing them yourself)*

---

## Live Hosted Application

This API is deployed and accessible at the following URL:

**[RENDER : I will add soon]**

You can test it directly using the same request bodies as above (just change `http://localhost:3000` to the live URL).

---

## Important Notes

* The database for the live hosted application may be PostgreSQL (recommended for production) or a persistent SQLite setup.
* Environment variables (like `DATABASE_URL`) are configured securely on the hosting platform.