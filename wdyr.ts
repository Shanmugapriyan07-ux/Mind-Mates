import whyDidYouRender from "@welldone-software/why-did-you-render";
import React from "react";

if (__DEV__) {
  whyDidYouRender(React, {
    trackAllPureComponents: true,
    trackHooks: true,
    logOwnerReasons: true,
    collapseGroups: true,
  });
}