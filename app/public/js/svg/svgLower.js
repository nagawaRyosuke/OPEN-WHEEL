/**
 * svg after task plug class
 */
class SvgLower extends SvgPlugBase {
    /**
     * create new instance
     * @param config plug config
     */
    constructor(config) {
        super(config);
        this.plugConfig.offsetX -= this.plugWidth / 2;
        this.plugConfig.offsetY -= 5;
        this.moveDefault();
        this.plug.draggable();
        const cable = this.plugConfig.svg.path('').fill('none').stroke({ color: this.plugConfig.color, width: 2 });
        this.cable = new SvgCable(cable, this.x(), this.y(), (startX, startY, endX, endY) => {
            const sx = this.plugConfig.offsetX + startX + this.plugWidth / 2;
            const sy = this.plugConfig.offsetY + startY + this.plugHeight / 2;
            const ex = this.plugConfig.offsetX + endX + this.plugWidth / 2;
            const ey = this.plugConfig.offsetY + endY + this.plugHeight / 2;
            const my = (sy + ey) / 2;
            const plot = [
                'M',
                `${sx} ${sy}`,
                'C',
                `${sx} ${my}`,
                `${ex} ${my}`,
                `${ex} ${ey}`
            ];
            return plot.join(' ');
        });
    }
    /**
     * whether this plug is connected or not
     * @return whether this plug is connected or not
     */
    isConnect() {
        return this.connectedUpper != null;
    }
    /**
     * add a listener for dragstart event
     * @param callback The function to call when we get the dragstart event
     * @return SvgLower instance
     */
    onDragstart(callback) {
        this.plug.on('dragstart', e => {
            e.preventDefault();
            callback();
        });
        return this;
    }
    /**
     * add a listener for mousedown event
     * @param callback The function to call when we get the mousedown event
     * @return SvgLower instance
     */
    onMousedown(callback) {
        this.plug.on('mousedown', e => {
            e.preventDefault();
            const upper = this.connectedUpper;
            if (this.isConnect()) {
                console.log(`disconnect ${this.name()} to ${this.connectedUpper.name()}`);
                this.connectedUpper.deleteConnect(this);
                this.connectedUpper = null;
            }
            else {
                this.cable.plotStart(this.x(), this.y());
            }
            callback(upper);
        });
        return this;
    }
    /**
     * add a listener for dragmove event
     * @param callback The function to call when we get the dragmove event
     * @return SvgLower instance
     */
    onDragmove(callback) {
        this.plug.on('dragmove', e => {
            if (this.isConnect()) {
                this.plotConnectedCable(this.connectedUpper);
            }
            else {
                this.cable.plotEnd(this.x(), this.y());
            }
            callback();
        });
        return this;
    }
    /**
     * add a listener for dragend event
     * @param callback The function to call when we get the dragend event
     * @return SvgLower instance
     */
    onDragend(callback) {
        this.plug.on('dragend', e => {
            e.preventDefault();
            callback();
        });
        return this;
    }
    /**
     * connect to after task plug
     * @param upper target after task plug
     * @param isBind if true, connection is not disconnect
     * @return whether connection is succeed or not
     */
    connect(upper, isBind) {
        if (upper != null && upper.connect(this)) {
            // console.log(`connect lower=${this.name()} to upper=${upper.name()}`);
            this.connectedUpper = upper;
            this.calcConnectPotision(this.connectedUpper, (x, y) => {
                this.move(x, y).front();
            }).plotConnectedCable(this.connectedUpper);
            if (isBind) {
                this.offDraggable();
            }
            return true;
        }
        else {
            this.cable.erase();
            this.moveDefault();
            return false;
        }
    }
    /**
     * move plug if this plug is not connected
     * @param x x point
     * @param y y point
     * @return SvgLower instance
     */
    moveIfDisconnect(x, y) {
        if (!this.isConnect()) {
            this.move(x, y);
        }
        else {
            this.cable.plotStart(x, y);
        }
        return this;
    }
    /**
     * calc connected plug position
     * @param upper connected after task plug
     * @param callback The function to call when we get point
     * @return SvgLower instance
     */
    calcConnectPotision(upper, callback) {
        if (this.isConnect() && upper != null) {
            const offset = upper.offset();
            const x = upper.x();
            const y = upper.y();
            callback(-this.plugConfig.offsetX + x + offset.x, -this.plugConfig.offsetY + y + offset.y);
        }
        return this;
    }
    /**
     * plot connected cable
     * @param upper connected after task plug
     * @return SvgLower instance
     */
    plotConnectedCable(upper) {
        if (this.isConnect()) {
            this.calcConnectPotision(upper, (x, y) => {
                this.cable.plotEnd(x, y);
            });
        }
        return this;
    }
    /**
     * remove all event listeners
     */
    offDraggable() {
        this.plug.off('mousedown', null);
        this.plug.off('dragstart', null);
        this.plug.off('dragmove', null);
        this.plug.off('dragend', null);
        this.plug.draggable(false);
    }
    /**
     * delete this plug
     * @return SvgConnector instance
     */
    delete() {
        this.plugConfig.svg = null;
        this.plugConfig.file = null;
        if (this.plug != null) {
            this.offDraggable();
            this.plug.remove();
            this.plug = null;
        }
        this.cable.remove();
        return this;
    }
}
//# sourceMappingURL=svgLower.js.map
