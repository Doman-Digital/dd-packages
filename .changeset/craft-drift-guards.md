---
"@domandigital/craft": minor
---

Two build gates from dd-drift-guards are now part of craft, so that repo can be archived. `gradientContrast(text, gradient, beneath)` scores text on a CSS gradient, the case axe-core and Lighthouse leave unscored, against the worst point of the gradient composited over what sits beneath. It samples between the stops as well as at them: the drift-guards version checked the stops only, and passed mid-grey text on a black-to-white gradient that is about 1:1 in the middle. `checkPhotoReview(text, options)` gates a build on the report `halide review --json` wrote, failing a weak image under a passing average, a truncated report and, unless `required: false`, a missing one.
