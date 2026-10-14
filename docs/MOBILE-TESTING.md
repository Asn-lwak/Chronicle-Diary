# Mobile testing checklist

Test the app at a narrow viewport (320–390 CSS pixels) and, if possible, on a real phone.

- [ ] Header brand and New Entry button do not overlap.
- [ ] Entries, Calendar, Analytics, Gallery, and Settings fit without horizontal page scrolling.
- [ ] Calendar date cells remain readable and tappable.
- [ ] Gallery images fit the available width.
- [ ] Entry editor toolbar can be scrolled horizontally; controls remain tappable.
- [ ] Microphone permission notice is fully visible above the editor.
- [ ] Minimize and restore preserve the current draft.
- [ ] Sketchpad fits the screen and drawing works with touch.
- [ ] Dialogs fit short screens and their buttons remain reachable.
- [ ] Test portrait and landscape orientation.

The CSS includes responsive refinements, but this checklist still needs to be completed on the target phone/browser. Camera, microphone, and geolocation may require localhost or HTTPS due to browser security rules.
