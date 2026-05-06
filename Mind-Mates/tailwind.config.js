/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: content paths are relative to this file
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}", "./lib/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        "rubik-bold":["Rubik-Bold","sans-serif"],
        "rubik-extrabold":["Rubik-ExtraBold","sans-serif"],
        "rubik-medium":["Rubik-Medium","sans-serif"],
        "rubik-regular":["Rubik-Regular","sans-serif"],
        "rubik-light":["Rubik-Light","sans-serif"],
      },
      colors: {
        "primary":
        {
          1: "#3365bb",
          2: "#5183cd",
          3: "#aec3d9",
        },
        accent:{
          1:"white",
        },
        black:{
          1:"black"
        }

       },
        
    },
  },
  plugins: [],
}