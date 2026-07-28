import assert from "node:assert/strict";
import test from "node:test";

const { buildAlertMarkup } = await import("../public/js/modules/renderAlerts.js");

test("published alerts render their uploaded image", () => {
  const markup = buildAlertMarkup({
    severity: "urgent",
    type: "weather-alert",
    timing: "Now",
    title: "Storm warning",
    message: "Take shelter.",
    imageUrl: "https://res.cloudinary.com/example/image/upload/storm.jpg",
    url: "/"
  });

  assert.match(markup, /class="site-alert-image"/);
  assert.match(markup, /src="https:\/\/res\.cloudinary\.com\/example\/image\/upload\/storm\.jpg"/);
  assert.match(markup, /alt="Storm warning alert image"/);
});

test("published alerts omit missing or unsafe images", () => {
  const withoutImage = buildAlertMarkup({ title: "No image" });
  const withUnsafeImage = buildAlertMarkup({
    title: "Unsafe image",
    imageUrl: "javascript:alert(1)"
  });

  assert.doesNotMatch(withoutImage, /site-alert-image/);
  assert.doesNotMatch(withUnsafeImage, /site-alert-image/);
});
