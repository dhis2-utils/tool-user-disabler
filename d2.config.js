/** @type {import('@dhis2/cli-app-scripts').D2Config} */
const config = {
    type: 'app',
    name: 'user-disabler',
    title: 'User Disabler',
    description: 'App to quickly find and disable inactive users.',
    author: 'HISP Centre - University of Oslo',
    minDHIS2Version: '2.41',

    entryPoints: {
        app: './src/App.tsx',
    },

    viteConfigExtensions: './viteConfigExtensions.mts',
}

module.exports = config
