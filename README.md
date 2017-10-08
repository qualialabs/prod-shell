# qualia:prod-shell

This package allows you to run the Meteor shell in production. Just SSH into the server and run `node ~/meteor-shell.js`.

If the Meteor server is running as a user different than the SSH user, go to the home directory of that user, and run `node meteor-shell.js`.

This package only exposes the Meteor shell to users with production SSH access. Security implications are minimal; if someone can SSH into your production server you have bigger problems.

This package was developed as a part of the more ambitious `qualia:web-shell` package which allows access to the Meteor shell inside of the *browser* (both in dev and production)!

## Installing

`meteor add qualia:prod-shell`
