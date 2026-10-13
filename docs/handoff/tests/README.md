# Tests

Browser tests written with Playwright for Python. They click through the demos the way a person would.

    pip install playwright
    playwright install chromium

Serve each demo, then run its scripts from this `tests` folder (the upload and import tests read `fixtures/`):

    # tenant workspace, 467 checks across 8 scripts
    cd ../tenant-workspace && python3 -m http.server 8801      # leave running
    cd ../tests && for f in tenant_wtest*.py; do python3 $f; done

    # platform console, 137 checks across 3 scripts
    cd ../platform-console && python3 -m http.server 8777      # leave running
    cd ../tests && for f in console_ptest*.py; do python3 $f; done

Each script prints PASS or FAIL for every check and a total at the end. The base address is the `B = '...'` line at the top of each file.
Use them as acceptance checks: point `B` at the new frontend and see which behaviours still need building.
Scripts that use dates (working days, calendar) compute what they expect from today's date.
