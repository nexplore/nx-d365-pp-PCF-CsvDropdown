# nx-d365-pp-PCF-CsvDropdown

## Overview

A PCF control that renders a dropdown populated from a semicolon-separated list of values.
Optionally the user can enter a custom free-text value.

## Configuration

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| Field | Bound field | Yes | The data field the selected value is written to (supports `Whole.None`, `Currency`, `FP`, `Decimal`, `SingleLine.Text`). |
| CSV Values | `SingleLine.Text` | Yes | Values separated by `;` that are displayed as dropdown options. |
| Allow Custom Value | `TwoOptions` | Yes | When set to **Yes**, a "Benutzerdefiniert…" option is appended to the dropdown that lets the user type a free-text value. |
| Custom Value Label | `SingleLine.Text` | No | Overrides the default label "Benutzerdefiniert…" shown for the custom-value option. |

## Features

- Populate a dropdown from a configurable semicolon-separated value list
- Optional free-text input via the "Benutzerdefiniert…" option (configurable label)
- Respects field-level security (disabled state) and required-field metadata
- Styled to match the native Model Driven App (Unified Interface) dropdown

## Preview

![PCF-CSV-Dropdown](assets/CsvDropdownPCF.gif)

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS)
- [Power Platform CLI](https://learn.microsoft.com/en-us/power-platform/developer/cli/introduction) (`pac`)
- [.NET SDK](https://dotnet.microsoft.com/download) or Visual Studio with MSBuild (required for solution builds)

### Setup

1. **Power Platform CLI Authentication**:

   ``` bash
   pac auth create --environment <Environment Url>
   ```

2. **Install**:

   ``` bash
   npm install
   ```

### Build and Deployment

1. **Local Build**:

   ``` bash
   npm run build
   ```

2. **Deploy control to environment**:

   ``` bash
   pac pcf push --incremental --publisher-prefix nx
   ```

### Debugging

1. **Start test Harness**:

   ``` bash
   npm start
   ```

2. **Watch mode for continuous development**:

   ``` bash
   npm start watch
   ```

## Build the Power Platform solution

### Increment the version

Before building a new solution for deployment, increase the `version` attribute in `CsvDropdownPCF/CsvDropdownControl/ControlManifest.Input.xml`. Otherwise an existing control in the target environment will not be replaced.

``` xml
<control ... version="1.0.1" ...>
```

### Build the control

From the root folder:

``` bash
cd CsvDropdownPCF
npm install
npm run build
cd ..
```

### Build the solution

``` bash
msbuild Solution\Solution.cdsproj /restore /t:rebuild /p:Configuration=Release
```

The built solution file is placed in `Solution\bin\Release\`.

### Import the solution

Import the generated `.zip` file into your Power Platform environment:

``` bash
pac solution import --path Solution\bin\Release\<SolutionName>.zip
```

Or import it manually via the [Power Apps Maker portal](https://make.powerapps.com) under **Solutions → Import solution**.
