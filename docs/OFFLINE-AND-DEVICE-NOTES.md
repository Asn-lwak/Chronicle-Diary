# Offline use and device compatibility

Chronicle is designed to load its interface from local files and keep diary data in this browser's local storage. It does not synchronize entries to a server. That means entries made on one device will not automatically appear on another device.

To move data between devices while staying offline, use Chronicle's backup/export and import/restore features, where available. Transfer the backup file manually using a USB drive, local file transfer, or another method that does not require Chronicle to contact a server. Keep separate backups of important entries and attachments.

Some browser features have platform restrictions. Microphone, camera, and location permissions may require opening Chronicle through `localhost`/a local server or a secure context, depending on the browser. This does not mean diary content needs to be synchronized online.

Responsive CSS was added to keep the editor's formatting and media controls from overlapping on narrow screens. Test on actual phones and tablets in addition to browser device emulation.
