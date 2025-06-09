export function extractCertification(detailsObject) { 
    let certification = 'NR';
    if (!detailsObject) return certification;
    const itemType = detailsObject.item_type || detailsObject.media_type || 'movie';
    if (itemType === 'movie' && detailsObject.release_dates?.results) {
        const usRelease = detailsObject.release_dates.results.find(r => r.iso_3166_1 === 'US');
        if (usRelease?.release_dates) {
            const certObj = usRelease.release_dates.find(rd => rd.certification && rd.certification !== '' && ([3,4,5,6].includes(rd.type)))
                || usRelease.release_dates.find(rd => rd.certification && rd.certification !== '');
            if (certObj) certification = certObj.certification;
        }
    } else if (itemType === 'tv' && detailsObject.content_ratings?.results) {
        const usRating = detailsObject.content_ratings.results.find(r => r.iso_3166_1 === 'US');
        if (usRating?.rating && usRating.rating !== '') certification = usRating.rating;
    }
    return certification;
}
