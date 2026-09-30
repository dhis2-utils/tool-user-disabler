# User Disabler Tool

> ![Maturity: Validated](https://img.shields.io/badge/maturity-Validated-yellow)  
> Intended use: finding and (bulk) disabling inactive users
> Maintainers: HISP Centre implementation team.
>
> **WARNING**
> This tool is intended to be used by system administrators to perform specific tasks, it is not intended for end users. It is available as a DHIS2 app, but has not been through the same rigorous testing as normal core apps. It should be used with care, and always tested in a development environment.

This DHIS2 app allows system administrators to efficiently manage user accounts by disabling inactive users based on a specified period of inactivity. Administrators can also include users who have never logged in and already disabled users in the filtering process. The purpose is to help administrators ensure only accounts that are in active use can be used to access the system.

Features
* Filter users based on the login date.
* Selectively disable multiple users in bulk.
* View user details in a modal dialog.


## License

© Copyright University of Oslo 2026

## Usage

### How to Use the App

1. **Access the App**: After installing the app in your DHIS2 instance, navigate to the "User Disabler" app through the DHIS2 interface.

2. **Set Filter Criteria**:
    - **Period Inactive**: Use the dropdown menu to select how you want to filter users (by months, years, or a specific date).
    - **Number of Periods**: If selecting months or years, specify the number (default is 6).
    - **Specific Date**: If you chose "Since date", input the desired date.
    - **Include Never Logged In**: Check this box if you wish to include users who have never logged in.
    - **Include Already Disabled Users**: Check this box to also include users who are already disabled in the results.

3. **Apply Filter**: Click on the **"Apply Filter"** button to fetch users based on the selected criteria. The app will display a table with the filtered users.

4. **Select Users**:
    - In the user list, check the checkbox next to the usernames of the users you wish to disable. You can also use the **"Select All"** checkbox at the top of the column to select all users that meet the filter criteria.

5. **Bulk Disable Users**:
    - After selecting the desired users, click the **"Bulk Disable"** button. A confirmation modal will appear showing the number of users that will be disabled.
    - Confirm the action by clicking **"Confirm"** in the confirmation modal. The app will then begin the bulk disabling process, and progress updates will be displayed.

6. **View User Details**: To see more information about a specific user, click the **"Info"** button next to the user in the table. A modal will show all relevant user details.

7. **Check Completion and Summary**:
    - Once the bulk disable process is complete, a summary modal will display the success count and any errors encountered during the operation.

8. **Error Handling**: If any errors occur during user updates, appropriate error messages will be displayed, allowing you to take necessary actions.

By following these steps, administrators can easily disable inactive users and manage user accounts efficiently within the DHIS2 platform.

### Technical Tips

- Ensure that you have the necessary permissions to disable user accounts in your DHIS2 instance.
- Always test in a development environment before applying changes in a production environment.

## Getting started

This app is built with the [DHIS2 App Platform](https://developers.dhis2.org/docs/app-platform/getting-started) (React, TypeScript, `@dhis2/ui`). It requires DHIS2 2.41 or later.

### Install dependencies

To install app dependencies:

```
pnpm install
```

### Start dev server

To start the development server against a local DHIS2 instance on `http://localhost:8080`:

```
pnpm start
```

To develop against a remote instance, use the built-in CORS proxy and log in with `http://localhost:8080` as the server URL:

```
pnpm start --proxy https://play.im.dhis2.org/dev
```

### Build

To build a production `.zip` file that can be installed in DHIS2 (output in `build/bundle/`):

```
pnpm run build
```

### Lint

```
pnpm run lint
```
