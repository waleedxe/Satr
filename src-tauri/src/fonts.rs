//! Lists font families installed on the system, for the font picker.

use std::collections::BTreeSet;

/// Unique family names of installed fonts, sorted case-insensitively.
/// Only names are read; font files are never sent to the frontend.
pub fn system_font_families() -> Vec<String> {
    let mut db = fontdb::Database::new();
    db.load_system_fonts();
    let names: BTreeSet<String> = db
        .faces()
        .filter_map(|face| {
            face.families
                .first()
                .map(|(name, _)| name.trim().to_string())
        })
        // Hidden/system-internal families start with a dot or '@' (vertical CJK).
        .filter(|name| !name.is_empty() && !name.starts_with('.') && !name.starts_with('@'))
        .collect();
    let mut list: Vec<String> = names.into_iter().collect();
    list.sort_by_key(|name| name.to_lowercase());
    list.dedup_by(|a, b| a.eq_ignore_ascii_case(b));
    list
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn returns_sorted_unique_names() {
        let fonts = system_font_families();
        let mut sorted = fonts.clone();
        sorted.sort_by_key(|n| n.to_lowercase());
        assert_eq!(fonts, sorted);
        if cfg!(windows) {
            assert!(fonts.iter().any(|f| f.eq_ignore_ascii_case("Segoe UI")));
        }
    }
}
