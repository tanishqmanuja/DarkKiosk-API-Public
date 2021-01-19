function cleanObject(obj) {
    const newObj = {};
    Object.keys(obj).forEach(key => {
        if (obj[key] && typeof obj[key] === "object") {
            newObj[key] = cleanObject(obj[key]);
        } else if (obj[key] != null) {
            newObj[key] = obj[key];
        }
    });
    return newObj;
};

module.exports = { cleanObject }