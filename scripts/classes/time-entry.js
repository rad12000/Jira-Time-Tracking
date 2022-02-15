class TimeEntry extends Array {
    constructor(array) {
        if(array) {
            super();
            Object.assign(this, array);
        } else {
            super(4).fill("");
        }
    }

    get ticketNumber() {
        return this[0];
    }

    set ticketNumber(ticketNumber) {
        this[0] = ticketNumber;
    }

    get startDate() {
        return this[1];
    }

    set startDate(startDate) {
        this[1] = startDate;
    }

    get timeSpent() {
        return this[2];
    }

    set timeSpent(timeSpent) {
        this[2] = timeSpent;
    }

    get comment() {
       return this[3];
    }

    get isActive () {
        return this.timeSpent.length >= 0;
    }

    set comment(comment) {
        this[3] = comment;
    }
}

export default TimeEntry;