/*
 * Lux Management for Mac: the app's starting program.
 *
 * Lux keeps its program file (resources.neu), data, settings, backups and saved
 * versions in ~/Library/Application Support/Lux Management, never inside the app.
 * Updates only replace resources.neu there, so the app itself stays exactly as it
 * was downloaded (its signature stays valid), and replacing or moving the app
 * never touches the data.
 *
 * This program copies the resources.neu that comes with the app into that folder
 * the first time, and once more whenever a newer app is installed. It then starts
 * the Neutralino runtime (Contents/MacOS/LuxManagement) on that folder.
 *
 * GitHub compiles it for Intel and Apple Silicon Macs (scripts/build.py).
 */
#include <mach-o/dyld.h>
#include <pwd.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>

#define HOME_FOLDER "/Library/Application Support/Lux Management"
#define VERSION_MARK "const APP_VERSION = '"
#define PATH_BUF 4096

static void join(char *out, const char *a, const char *b) {
    if (snprintf(out, PATH_BUF, "%s%s", a, b) >= PATH_BUF) {
        fprintf(stderr, "Lux Management: the path %s%s is too long\n", a, b);
        exit(1);
    }
}

static char *read_file(const char *path, size_t *len) {
    FILE *f = fopen(path, "rb");
    if (!f) return NULL;
    char *buf = NULL;
    if (fseek(f, 0, SEEK_END) == 0) {
        long n = ftell(f);
        if (n > 0 && fseek(f, 0, SEEK_SET) == 0 && (buf = malloc((size_t)n)) != NULL) {
            if (fread(buf, 1, (size_t)n, f) == (size_t)n) *len = (size_t)n;
            else { free(buf); buf = NULL; }
        }
    }
    fclose(f);
    return buf;
}

/* The program version inside a resources.neu, read from its index.html. */
static int version_of(const char *path, int v[3]) {
    size_t len = 0;
    char *buf = read_file(path, &len);
    if (!buf) return 0;
    int ok = 0;
    char *hit = memmem(buf, len, VERSION_MARK, strlen(VERSION_MARK));
    if (hit) {
        char tail[32] = {0};
        size_t at = (size_t)(hit - buf) + strlen(VERSION_MARK);
        memcpy(tail, buf + at, len - at < sizeof tail - 1 ? len - at : sizeof tail - 1);
        ok = sscanf(tail, "%d.%d.%d'", &v[0], &v[1], &v[2]) == 3;
    }
    free(buf);
    return ok;
}

static int newer(const int a[3], const int b[3]) {
    for (int i = 0; i < 3; i++) if (a[i] != b[i]) return a[i] > b[i];
    return 0;
}

static void make_dirs(const char *path) {
    char p[PATH_BUF];
    join(p, path, "");
    for (char *s = p + 1; *s; s++) {
        if (*s == '/') { *s = 0; mkdir(p, 0755); *s = '/'; }
    }
    mkdir(p, 0755);
}

/* Copy through a temporary file so a half-written resources.neu is never left behind. */
static int copy_file(const char *from, const char *to) {
    size_t len = 0;
    char *buf = read_file(from, &len);
    if (!buf) return 0;
    char tmp[PATH_BUF];
    join(tmp, to, ".new");
    FILE *f = fopen(tmp, "wb");
    int ok = f && fwrite(buf, 1, len, f) == len;
    if (f && fclose(f) != 0) ok = 0;
    free(buf);
    if (ok) ok = rename(tmp, to) == 0;
    if (!ok) unlink(tmp);
    return ok;
}

int main(void) {
    char exe[PATH_BUF], self[PATH_BUF];
    uint32_t size = sizeof exe;
    if (_NSGetExecutablePath(exe, &size) != 0) return 1;
    if (!realpath(exe, self)) join(self, exe, "");
    char *slash = strrchr(self, '/');             /* .../Lux Management.app/Contents/MacOS */
    if (!slash) return 1;
    *slash = 0;

    const char *home = getenv("HOME");
    if (!home || !*home) {
        struct passwd *pw = getpwuid(getuid());
        home = pw ? pw->pw_dir : "/tmp";
    }
    char dir[PATH_BUF], installed[PATH_BUF], bundled[PATH_BUF], seen[PATH_BUF], cfg[PATH_BUF], runtime[PATH_BUF], arg[PATH_BUF];
    join(dir, home, HOME_FOLDER);
    join(installed, dir, "/resources.neu");
    join(cfg, dir, "/config");
    join(seen, cfg, "/app-version.txt");
    join(bundled, self, "/../Resources/resources.neu");
    join(runtime, self, "/LuxManagement");
    join(arg, "--path=", dir);
    make_dirs(dir);

    /* Copy the app's program version the first time, and once after a newer app is
       installed. Otherwise leave it alone: it may have been updated, or deliberately
       taken back to an earlier version from Settings > Version history. */
    int vb[3], vi[3];
    if (version_of(bundled, vb)) {
        char vbs[40] = {0}, last[40] = {0};
        snprintf(vbs, sizeof vbs, "%d.%d.%d", vb[0], vb[1], vb[2]);
        FILE *f = fopen(seen, "r");
        if (f) { if (!fgets(last, sizeof last, f)) last[0] = 0; fclose(f); }
        last[strcspn(last, "\r\n")] = 0;
        int have = version_of(installed, vi);
        if (!have || (strcmp(last, vbs) != 0 && newer(vb, vi))) copy_file(bundled, installed);
        if (strcmp(last, vbs) != 0) {
            make_dirs(cfg);
            if ((f = fopen(seen, "w"))) { fprintf(f, "%s\n", vbs); fclose(f); }
        }
    }

    char *args[] = {runtime, arg, NULL};
    execv(runtime, args);
    perror("Lux Management could not start");
    return 1;
}
