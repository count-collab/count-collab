<script lang="ts">
  import { addIcons } from "ionicons";
  import { defineCustomElement } from "ionicons/components/ion-icon.js";
  import {
    addCircleOutline,
    addOutline,
    arrowBackOutline,
    bookmark,
    bookmarkOutline,
    cafeOutline,
    checkmarkCircle,
    checkmarkOutline,
    closeOutline,
    copyOutline,
    createOutline,
    desktopOutline,
    ellipsisVertical,
    eyeOutline,
    flagOutline,
    flashOutline,
    globeOutline,
    gridOutline,
    heart,
    heartOutline,
    homeOutline,
    listOutline,
    lockClosedOutline,
    logInOutline,
    logOutOutline,
    logoDiscord,
    logoGoogle,
    logoTwitch,
    menuOutline,
    moonOutline,
    peopleOutline,
    personOutline,
    personRemoveOutline,
    removeCircleOutline,
    searchOutline,
    settingsOutline,
    shareSocialOutline,
    shieldOutline,
    sparklesOutline,
    sunnyOutline,
    swapVerticalOutline,
    timeOutline,
    trashOutline,
    trendingUpOutline,
    trophyOutline,
  } from "ionicons/icons";
  import { browser } from "$app/environment";
  import "../app.css";

  if (browser) {
    addIcons({
      "add-outline": addOutline,
      "arrow-back-outline": arrowBackOutline,
      "close-outline": closeOutline,
      "menu-outline": menuOutline,
      "home-outline": homeOutline,
      "grid-outline": gridOutline,
      heart: heart,
      "heart-outline": heartOutline,
      bookmark: bookmark,
      "bookmark-outline": bookmarkOutline,
      "cafe-outline": cafeOutline,
      "add-circle-outline": addCircleOutline,
      "list-outline": listOutline,
      "shield-outline": shieldOutline,
      "log-out-outline": logOutOutline,
      "log-in-outline": logInOutline,
      "share-social-outline": shareSocialOutline,
      "create-outline": createOutline,
      "eye-outline": eyeOutline,
      "flash-outline": flashOutline,
      "flag-outline": flagOutline,
      "globe-outline": globeOutline,
      "lock-closed-outline": lockClosedOutline,
      "trash-outline": trashOutline,
      "ellipsis-vertical": ellipsisVertical,
      "copy-outline": copyOutline,
      "checkmark-circle": checkmarkCircle,
      "checkmark-outline": checkmarkOutline,
      "logo-google": logoGoogle,
      "logo-discord": logoDiscord,
      "logo-twitch": logoTwitch,
      "person-outline": personOutline,
      "person-remove-outline": personRemoveOutline,
      "people-outline": peopleOutline,
      "remove-circle-outline": removeCircleOutline,
      "search-outline": searchOutline,
      "settings-outline": settingsOutline,
      "trending-up-outline": trendingUpOutline,
      "trophy-outline": trophyOutline,
      "sparkles-outline": sparklesOutline,
      "sunny-outline": sunnyOutline,
      "moon-outline": moonOutline,
      "desktop-outline": desktopOutline,
      "swap-vertical-outline": swapVerticalOutline,
      "time-outline": timeOutline,
    });
    defineCustomElement();
  }

  const { children } = $props();
</script>

<div
  class="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 overflow-x-hidden"
>
  {@render children()}
</div>
